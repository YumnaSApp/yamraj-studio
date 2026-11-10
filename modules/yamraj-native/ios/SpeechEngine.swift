import AVFoundation
import Combine

enum SpeechError: LocalizedError {
    case noAudio, timeout
    var errorDescription: String? {
        switch self {
        case .noAudio: return "No sound came out. Check that a Hindi voice is installed (Settings → Accessibility → Spoken Content → Voices → Hindi)."
        case .timeout: return "Voice took too long. Try a shorter line."
        }
    }
}

/// Live preview with Apple's free offline voices.
final class SpeechEngine: NSObject, ObservableObject, AVSpeechSynthesizerDelegate {
    static let shared = SpeechEngine()

    @Published var isSpeaking = false
    private let synth = AVSpeechSynthesizer()

    override init() {
        super.init()
        synth.delegate = self
    }

    // MARK: Voices

    static var hindiVoices: [AVSpeechSynthesisVoice] {
        AVSpeechSynthesisVoice.speechVoices()
            .filter { $0.language.hasPrefix("hi") }
            .sorted { $0.quality.rawValue > $1.quality.rawValue }
    }

    static func voice(preferMale: Bool, identifier: String?) -> AVSpeechSynthesisVoice? {
        if let identifier, !identifier.isEmpty, let v = AVSpeechSynthesisVoice(identifier: identifier) { return v }
        let hindi = hindiVoices
        if preferMale, let male = hindi.first(where: { $0.gender == .male }) { return male }
        return hindi.first ?? AVSpeechSynthesisVoice(language: "hi-IN")
    }

    static func utterance(text: String, pitch: Float, rate: Float, voice: AVSpeechSynthesisVoice?) -> AVSpeechUtterance {
        let u = AVSpeechUtterance(string: text)
        u.pitchMultiplier = max(0.5, min(2.0, pitch))
        u.rate = max(AVSpeechUtteranceMinimumSpeechRate, min(AVSpeechUtteranceMaximumSpeechRate, rate))
        u.voice = voice
        u.preUtteranceDelay = 0
        u.postUtteranceDelay = 0
        u.volume = 1
        return u
    }

    static func activateSession() {
        let s = AVAudioSession.sharedInstance()
        try? s.setCategory(.playback, mode: .default, options: [.duckOthers])
        try? s.setActive(true)
    }

    // MARK: Preview

    func speak(_ u: AVSpeechUtterance) {
        Self.activateSession()
        if synth.isSpeaking { synth.stopSpeaking(at: .immediate) }
        synth.speak(u)
    }

    func stop() { synth.stopSpeaking(at: .immediate) }

    func speechSynthesizer(_ s: AVSpeechSynthesizer, didStart u: AVSpeechUtterance) {
        DispatchQueue.main.async { self.isSpeaking = true }
    }
    func speechSynthesizer(_ s: AVSpeechSynthesizer, didFinish u: AVSpeechUtterance) {
        DispatchQueue.main.async { self.isSpeaking = false }
    }
    func speechSynthesizer(_ s: AVSpeechSynthesizer, didCancel u: AVSpeechUtterance) {
        DispatchQueue.main.async { self.isSpeaking = false }
    }
}

/// Renders an utterance to an audio file (offline, free).
final class SpeechRenderer {
    private var synth: AVSpeechSynthesizer?

    /// Writes raw speech, then cleans it (trim, normalise, optional echo) into `output` (.caf).
    /// Returns the duration in seconds.
    func render(_ utterance: AVSpeechUtterance, to output: URL, echo: Bool) async throws -> Double {
        let raw = FileStore.temp.appendingPathComponent(UUID().uuidString + ".caf")
        defer { FileStore.delete(raw) }
        try await writeRaw(utterance, to: raw)
        return try AudioFX.process(input: raw, output: output, echo: echo)
    }

    private func writeRaw(_ utterance: AVSpeechUtterance, to url: URL) async throws {
        let synth = AVSpeechSynthesizer()
        self.synth = synth
        defer { self.synth = nil }
        let state = WriteState(url: url)
        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
            state.continuation = cont
            state.startWatchdog()
            synth.write(utterance) { buffer in
                state.handle(buffer)
            }
        }
    }
}

/// Thread-safe state for one speech write.
private final class WriteState {
    let url: URL
    var continuation: CheckedContinuation<Void, Error>?
    private var file: AVAudioFile?
    private var finished = false
    private var wroteFrames: AVAudioFramePosition = 0
    private var lastWrite = Date()
    private let started = Date()
    private let lock = NSLock()

    init(url: URL) { self.url = url }

    func handle(_ buffer: AVAudioBuffer) {
        lock.lock(); defer { lock.unlock() }
        guard !finished, let pcm = buffer as? AVAudioPCMBuffer else { return }
        if pcm.frameLength == 0 { finish(nil); return }
        do {
            if file == nil {
                file = try AVAudioFile(forWriting: url,
                                       settings: pcm.format.settings,
                                       commonFormat: pcm.format.commonFormat,
                                       interleaved: pcm.format.isInterleaved)
            }
            try file?.write(from: pcm)
            wroteFrames += AVAudioFramePosition(pcm.frameLength)
            lastWrite = Date()
        } catch {
            finish(error)
        }
    }

    /// Some iOS versions never send the final empty buffer – finish after a short silence.
    func startWatchdog() {
        DispatchQueue.global().asyncAfter(deadline: .now() + 0.4) { [weak self] in
            guard let self else { return }
            self.lock.lock()
            if self.finished { self.lock.unlock(); return }
            if self.wroteFrames > 0, Date().timeIntervalSince(self.lastWrite) > 1.5 {
                self.finish(nil); self.lock.unlock(); return
            }
            if self.wroteFrames == 0, Date().timeIntervalSince(self.started) > 15 {
                self.finish(SpeechError.timeout); self.lock.unlock(); return
            }
            self.lock.unlock()
            self.startWatchdog()
        }
    }

    // must be called with lock held
    private func finish(_ error: Error?) {
        guard !finished else { return }
        finished = true
        file = nil // closes the file
        if let error {
            continuation?.resume(throwing: error)
        } else if wroteFrames == 0 {
            continuation?.resume(throwing: SpeechError.noAudio)
        } else {
            continuation?.resume()
        }
        continuation = nil
    }
}
