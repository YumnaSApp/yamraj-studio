import AVFoundation

enum MusicKind: String, CaseIterable, Identifiable {
    case none = "None", funny = "Funny", horror = "Horror", dramatic = "Dramatic"
    var id: String { rawValue }
    var emoji: String {
        switch self {
        case .none: return "🔇"
        case .funny: return "🤡"
        case .horror: return "👻"
        case .dramatic: return "🎭"
        }
    }
}

enum SFXKind: String, CaseIterable, Identifiable, Codable {
    case dham = "Dham", scratch = "Record Scratch", laugh = "Audience Laugh"
    var id: String { rawValue }
    var emoji: String {
        switch self {
        case .dham: return "🥁"
        case .scratch: return "💿"
        case .laugh: return "😂"
        }
    }
}

/// All music & sound effects are generated in code — 100% original, no copyright.
enum AudioSynth {
    static let sr = 44_100.0

    static func url(for music: MusicKind) throws -> URL? {
        guard music != .none else { return nil }
        let url = FileStore.synth.appendingPathComponent("music_\(music.rawValue)_v1.caf")
        if FileManager.default.fileExists(atPath: url.path) { return url }
        let samples: [Float]
        switch music {
        case .funny: samples = funnyLoop()
        case .horror: samples = horrorLoop()
        case .dramatic: samples = dramaticLoop()
        case .none: return nil
        }
        try AudioFX.writeMono(AudioFX.normalize(samples, peak: 0.8), sampleRate: sr, to: url)
        return url
    }

    static func url(for sfx: SFXKind) async throws -> URL {
        let url = FileStore.synth.appendingPathComponent("sfx_\(sfx.id.replacingOccurrences(of: " ", with: "_"))_v1.caf")
        if FileManager.default.fileExists(atPath: url.path) { return url }
        switch sfx {
        case .dham:    try AudioFX.writeMono(AudioFX.normalize(dham(), peak: 0.95), sampleRate: sr, to: url)
        case .scratch: try AudioFX.writeMono(AudioFX.normalize(scratch(), peak: 0.9), sampleRate: sr, to: url)
        case .laugh:   try await makeLaugh(to: url)
        }
        return url
    }

    // MARK: - Building blocks

    private struct RNG {
        var state: UInt64 = 0x9E3779B97F4A7C15
        mutating func next() -> Float {
            state = state &* 6364136223846793005 &+ 1442695040888963407
            return Float(Int64(bitPattern: state >> 1) % 2_000_000) / 1_000_000 - 1
        }
    }

    private static func buffer(_ seconds: Double) -> [Float] { [Float](repeating: 0, count: Int(seconds * sr)) }

    private static func add(_ src: [Float], into dst: inout [Float], at seconds: Double, gain: Float = 1) {
        let o = Int(seconds * sr)
        for i in 0..<src.count where o + i < dst.count { dst[o + i] += src[i] * gain }
    }

    private static func pluck(_ freq: Double, _ dur: Double = 0.25) -> [Float] {
        let n = Int(dur * sr)
        return (0..<n).map { i in
            let t = Double(i) / sr
            let v = sin(2 * .pi * freq * t) + 0.35 * sin(4 * .pi * freq * t) + 0.15 * sin(6 * .pi * freq * t)
            return Float(v * exp(-12 * t))
        }
    }

    private static func boom(from f0: Double, to f1: Double, dur: Double, decay: Double) -> [Float] {
        let n = Int(dur * sr)
        var phase = 0.0
        return (0..<n).map { i in
            let t = Double(i) / sr
            let f = f1 + (f0 - f1) * exp(-t * 9)
            phase += 2 * .pi * f / sr
            return Float(sin(phase) * exp(-t * decay))
        }
    }

    // MARK: - Music loops (7.5 s, loop seamlessly)

    private static func funnyLoop() -> [Float] {
        let bpm = 128.0, beat = 60 / bpm
        var out = buffer(beat * 16)
        let melody: [Double] = [523, 659, 784, 659, 587, 698, 880, 698, 523, 659, 784, 1047, 988, 784, 659, 587,
                                523, 659, 784, 659, 587, 698, 880, 698, 784, 698, 659, 587, 523, 494, 523, 0]
        for (i, f) in melody.enumerated() where f > 0 { add(pluck(f), into: &out, at: Double(i) * beat / 2, gain: 0.35) }
        let bass: [Double] = [131, 196, 147, 220, 131, 196, 98, 196]
        for (i, f) in bass.enumerated() {
            add(pluck(f, 0.35), into: &out, at: Double(i) * beat * 2, gain: 0.6)
            add(boom(from: 140, to: 60, dur: 0.18, decay: 22), into: &out, at: Double(i) * beat * 2, gain: 0.5)
        }
        return out
    }

    private static func horrorLoop() -> [Float] {
        let dur = 7.5
        var rng = RNG()
        var lp: Float = 0
        return (0..<Int(dur * sr)).map { i in
            let t = Double(i) / sr
            let trem = 0.7 + 0.3 * sin(2 * .pi * 0.4 * t)
            var v = (sin(2 * .pi * 55 * t) + sin(2 * .pi * 58.3 * t) + 0.5 * sin(2 * .pi * 82.4 * t)) * 0.3 * trem
            // eerie high tone in the middle
            let env = max(0, sin(.pi * (t - 2.5) / 4)) * (t > 2.5 && t < 6.5 ? 1 : 0)
            v += 0.12 * env * sin(2 * .pi * (880 + 40 * sin(2 * .pi * 0.25 * t)) * t)
            // wind noise
            lp += 0.02 * (rng.next() - lp)
            v += Double(lp) * 1.8 * (0.6 + 0.4 * sin(2 * .pi * 0.13 * t))
            // fade edges so the loop is seamless
            let edge = min(1, t / 0.3, (dur - t) / 0.3)
            return Float(v * edge)
        }
    }

    private static func dramaticLoop() -> [Float] {
        let dur = 7.5
        var out = (0..<Int(dur * sr)).map { i -> Float in
            let t = Double(i) / sr
            let chord: [Double] = t < 3.75 ? [220, 261.6, 329.6] : [174.6, 220, 261.6]
            var v = 0.0
            for f in chord { for h in 1...4 { v += sin(2 * .pi * f * Double(h) * t + Double(h)) / Double(h * h) } }
            let local = t.truncatingRemainder(dividingBy: 3.75)
            let swell = min(1, local / 1.2) * min(1, (3.75 - local) / 0.3)
            return Float(v * 0.12 * swell)
        }
        for k in 0..<4 { add(boom(from: 110, to: 55, dur: 1.2, decay: 3.5), into: &out, at: Double(k) * 1.875, gain: k % 2 == 0 ? 0.9 : 0.55) }
        return out
    }

    // MARK: - SFX

    private static func dham() -> [Float] {
        var out = buffer(2.4)
        var rng = RNG()
        for (k, t) in [0.0, 0.42, 0.84].enumerated() {
            add(boom(from: 160, to: 42, dur: 1.4, decay: k == 2 ? 2.2 : 4.5), into: &out, at: t, gain: k == 2 ? 1.0 : 0.8)
            let click = (0..<Int(0.03 * sr)).map { i in rng.next() * Float(exp(-Double(i) / (0.006 * sr))) }
            add(click, into: &out, at: t, gain: 0.4)
        }
        return AudioFX.addEcho(out, sampleRate: sr, delay: 0.11, feedback: 0.25, tail: 0.4)
    }

    private static func scratch() -> [Float] {
        let dur = 0.75
        var rng = RNG()
        var phase = 0.0
        return (0..<Int(dur * sr)).map { i in
            let t = Double(i) / sr
            let motion = sin(2 * .pi * 2.6 * t)                  // back & forth
            let f = 180 + 1400 * abs(motion)
            phase += 2 * .pi * f / sr
            let tone = sin(phase) * 0.6 + sin(phase * 2.01) * 0.25
            let noise = Double(rng.next()) * 0.35 * abs(motion)
            let env = min(1, t / 0.01) * (t > dur - 0.08 ? (dur - t) / 0.08 : 1)
            return Float((tone + noise) * env)
        }
    }

    /// "Audience laugh" made from several sped-up Hindi "हा हा" voices layered together.
    private static func makeLaugh(to url: URL) async throws {
        let voice = SpeechEngine.voice(preferMale: false, identifier: nil)
        let layers: [(pitch: Float, rate: Float, offset: Double, gain: Float, text: String)] = [
            (1.6, 0.62, 0.00, 0.8, "हा हा हा हा हा हा"),
            (1.2, 0.58, 0.12, 0.9, "हा हा हा हा हा"),
            (0.85, 0.55, 0.25, 0.8, "हो हो हो हा हा"),
            (1.9, 0.65, 0.06, 0.6, "ही ही ही ही ही"),
        ]
        var parts: [(samples: [Float], offset: Double, gain: Float)] = []
        var rate = sr
        for l in layers {
            let tmp = FileStore.temp.appendingPathComponent(UUID().uuidString + ".caf")
            defer { FileStore.delete(tmp) }
            let u = SpeechEngine.utterance(text: l.text, pitch: l.pitch, rate: l.rate, voice: voice)
            _ = try await SpeechRenderer().render(u, to: tmp, echo: false)
            let (s, r) = try AudioFX.readMono(tmp)
            rate = r
            parts.append((s, l.offset, l.gain))
        }
        var mixed = AudioFX.mix(parts, sampleRate: rate)
        mixed = AudioFX.addEcho(mixed, sampleRate: rate, delay: 0.07, feedback: 0.3, tail: 0.5)
        try AudioFX.writeMono(AudioFX.normalize(mixed, peak: 0.9), sampleRate: rate, to: url)
    }
}
