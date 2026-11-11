import AVFoundation

/// Small sample-level helpers: read/write mono float audio, echo, normalise.
enum AudioFX {
    enum FXError: Error { case badFormat }

    static func readMono(_ url: URL) throws -> (samples: [Float], sampleRate: Double) {
        let file = try AVAudioFile(forReading: url)
        let format = file.processingFormat
        let count = AVAudioFrameCount(file.length)
        guard count > 0, let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: count) else {
            return ([], format.sampleRate)
        }
        try file.read(into: buffer)
        guard let data = buffer.floatChannelData else { throw FXError.badFormat }
        let n = Int(buffer.frameLength)
        let channels = Int(format.channelCount)
        var out = [Float](repeating: 0, count: n)
        for c in 0..<channels {
            let p = data[c]
            for i in 0..<n { out[i] += p[i] / Float(channels) }
        }
        return (out, format.sampleRate)
    }

    static func writeMono(_ samples: [Float], sampleRate: Double, to url: URL) throws {
        FileStore.delete(url)
        guard let format = AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 1) else { throw FXError.badFormat }
        let file = try AVAudioFile(forWriting: url, settings: format.settings)
        let chunk = 32_768
        var start = 0
        while start < samples.count {
            let len = min(chunk, samples.count - start)
            guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(len)) else { throw FXError.badFormat }
            buffer.frameLength = AVAudioFrameCount(len)
            let dst = buffer.floatChannelData![0]
            for i in 0..<len { dst[i] = samples[start + i] }
            try file.write(from: buffer)
            start += len
        }
    }

    /// Trim silence, optional echo, normalise. Returns duration.
    static func process(input: URL, output: URL, echo: Bool, effect: String = "") throws -> Double {
        var (s, sr) = try readMono(input)
        s = trimSilence(s, sampleRate: sr)
        s = applyEffect(s, sampleRate: sr, effect: effect)
        if echo { s = addEcho(s, sampleRate: sr) }
        s = normalize(s, peak: 0.95)
        try writeMono(s, sampleRate: sr, to: output)
        return Double(s.count) / sr
    }

    /// Funny voice effects: robot, radio, cave
    static func applyEffect(_ input: [Float], sampleRate sr: Double, effect: String) -> [Float] {
        switch effect {
        case "robot":
            var out = input
            for i in 0..<out.count {
                let t = Double(i) / sr
                out[i] = input[i] * Float(sin(2 * .pi * 55 * t)) * 1.3 + input[i] * 0.25
            }
            return addEcho(out, sampleRate: sr, delay: 0.03, feedback: 0.4, tail: 0.2)
        case "radio":
            var out = [Float](repeating: 0, count: input.count)
            var lp: Float = 0, hpPrev: Float = 0, hpOut: Float = 0
            for i in 0..<input.count {
                lp += 0.35 * (input[i] - lp)                 // cut highs
                hpOut = 0.92 * (hpOut + lp - hpPrev)          // cut lows
                hpPrev = lp
                out[i] = Float(tanh(Double(hpOut) * 3))       // a bit of crunch
            }
            return out
        case "cave":
            return addEcho(input, sampleRate: sr, delay: 0.28, feedback: 0.5, tail: 1.6)
        default:
            return input
        }
    }

    static func trimSilence(_ s: [Float], sampleRate: Double, threshold: Float = 0.01) -> [Float] {
        guard let first = s.firstIndex(where: { abs($0) > threshold }),
              let last = s.lastIndex(where: { abs($0) > threshold }) else { return s }
        let pad = Int(0.05 * sampleRate)
        let a = max(0, first - pad), b = min(s.count - 1, last + pad)
        return Array(s[a...b])
    }

    static func addEcho(_ s: [Float], sampleRate: Double, delay: Double = 0.16, feedback: Float = 0.35, tail: Double = 0.9) -> [Float] {
        let d = Int(delay * sampleRate)
        var out = s + [Float](repeating: 0, count: Int(tail * sampleRate))
        guard d > 0 else { return out }
        for i in d..<out.count { out[i] += out[i - d] * feedback }
        return out
    }

    static func normalize(_ s: [Float], peak: Float) -> [Float] {
        let m = s.reduce(0) { max($0, abs($1)) }
        guard m > 0.0001 else { return s }
        let g = peak / m
        return s.map { $0 * g }
    }

    /// Mix several sample arrays at offsets (seconds).
    static func mix(_ parts: [(samples: [Float], offset: Double, gain: Float)], sampleRate: Double) -> [Float] {
        let length = parts.map { Int($0.offset * sampleRate) + $0.samples.count }.max() ?? 0
        var out = [Float](repeating: 0, count: length)
        for p in parts {
            let o = Int(p.offset * sampleRate)
            for i in 0..<p.samples.count { out[o + i] += p.samples[i] * p.gain }
        }
        return out
    }
}
