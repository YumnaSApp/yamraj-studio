import ExpoModulesCore
import AVFoundation
import UIKit

/// Bridge between the React Native screens and the Swift voice / video engine.
public class YamrajNativeModule: Module {
    public func definition() -> ModuleDefinition {
        Name("YamrajNative")

        // ---------- files ----------
        Function("documentsPath") { () -> String in
            FileStore.documents.path
        }

        Function("readJSON") { (name: String) -> String? in
            let url = FileStore.documents.appendingPathComponent(name)
            return try? String(contentsOf: url, encoding: .utf8)
        }

        Function("writeJSON") { (name: String, text: String) -> Bool in
            let url = FileStore.documents.appendingPathComponent(name)
            return (try? text.write(to: url, atomically: true, encoding: .utf8)) != nil
        }

        Function("deleteFile") { (path: String) in
            FileStore.delete(FileStore.resolve(path))
        }

        // ---------- voices ----------
        Function("hindiVoices") { () -> [[String: Any]] in
            SpeechEngine.hindiVoices.map { v in
                [
                    "id": v.identifier,
                    "name": v.name,
                    "gender": v.gender == .male ? "male" : (v.gender == .female ? "female" : "other"),
                    "enhanced": v.quality != .default,
                ]
            }
        }

        Function("speak") { (text: String, pitch: Double, rate: Double, voiceId: String?, preferMale: Bool) in
            let voice = SpeechEngine.voice(preferMale: preferMale, identifier: voiceId)
            let u = SpeechEngine.utterance(text: text, pitch: Float(pitch), rate: Float(rate), voice: voice)
            DispatchQueue.main.async { SpeechEngine.shared.speak(u) }
        }

        Function("stopSpeaking") {
            DispatchQueue.main.async { SpeechEngine.shared.stop() }
        }

        /// Saves speech to Documents/Audio. Returns { path (relative), duration }.
        AsyncFunction("renderSpeech") { (text: String, pitch: Double, rate: Double, voiceId: String?, preferMale: Bool, echo: Bool) async throws -> [String: Any] in
            let voice = SpeechEngine.voice(preferMale: preferMale, identifier: voiceId)
            let u = SpeechEngine.utterance(text: text, pitch: Float(pitch), rate: Float(rate), voice: voice)
            let name = "voice_\(UUID().uuidString).caf"
            let url = FileStore.audio.appendingPathComponent(name)
            let duration = try await SpeechRenderer().render(u, to: url, echo: echo)
            return ["path": "Audio/\(name)", "duration": duration]
        }

        // ---------- playback ----------
        Function("playFile") { (path: String) in
            try ClipPlayer.shared.play(FileStore.resolve(path))
        }

        Function("stopPlayback") {
            ClipPlayer.shared.stop()
        }

        AsyncFunction("playMusic") { (kind: String) in
            guard let m = MusicKind(rawValue: kind), let url = try AudioSynth.url(for: m) else { return }
            try ClipPlayer.shared.play(url)
        }

        AsyncFunction("playSFX") { (kind: String) async throws in
            guard let s = SFXKind(rawValue: kind) else { return }
            let url = try await AudioSynth.url(for: s)
            try ClipPlayer.shared.play(url)
        }

        // ---------- photos ----------
        AsyncFunction("pickImage") { () async -> String? in
            let presenter = await MainActor.run { self.appContext?.utilities?.currentViewController() }
            return await ImagePicker.pick(from: presenter)
        }

        // ---------- export ----------
        Events("onExportProgress")

        /// options: { image?, clips:[{path,text,speaker,duration}], music, musicVolume, voiceVolume,
        ///            sfx:[{kind,time}], captions, showSpeaker, hookText, endCard, endCardHandle, watermark }
        AsyncFunction("exportVideo") { (options: [String: Any]) async throws -> [String: Any] in
            var image: UIImage?
            if let p = options["image"] as? String, !p.isEmpty {
                image = UIImage(contentsOfFile: FileStore.resolve(p).path)
            }
            let clips: [ExportClip] = (options["clips"] as? [[String: Any]] ?? []).compactMap { c in
                guard let p = c["path"] as? String else { return nil }
                return ExportClip(url: FileStore.resolve(p),
                                  text: c["text"] as? String ?? "",
                                  speaker: c["speaker"] as? String ?? "",
                                  duration: (c["duration"] as? NSNumber)?.doubleValue ?? 1)
            }
            var s = ExportSettings(image: image, clips: clips)
            s.music = MusicKind(rawValue: options["music"] as? String ?? "None") ?? .none
            s.musicVolume = (options["musicVolume"] as? NSNumber)?.floatValue ?? 0.25
            s.voiceVolume = (options["voiceVolume"] as? NSNumber)?.floatValue ?? 1
            s.sfx = (options["sfx"] as? [[String: Any]] ?? []).compactMap { d in
                guard let k = SFXKind(rawValue: d["kind"] as? String ?? "") else { return nil }
                return SFXCue(kind: k, time: (d["time"] as? NSNumber)?.doubleValue ?? 0)
            }
            s.captions = options["captions"] as? Bool ?? true
            s.showSpeaker = options["showSpeaker"] as? Bool ?? true
            s.hookText = options["hookText"] as? String ?? ""
            s.endCard = options["endCard"] as? Bool ?? true
            s.endCardHandle = options["endCardHandle"] as? String ?? ""
            s.watermark = options["watermark"] as? Bool ?? true

            let url = try await VideoExporter.export(s) { [weak self] p in
                self?.sendEvent("onExportProgress", ["progress": p])
            }
            return ["path": "Videos/\(url.lastPathComponent)", "absolutePath": url.path, "duration": s.totalLength]
        }

        // ---------- Pro (in-app purchase) ----------
        AsyncFunction("proStatus") { () async -> [String: Any] in
            let store = await ProStore.shared
            await store.load()
            let pro = await store.isPro
            let price = await store.product?.displayPrice ?? ""
            return ["isPro": pro, "price": price]
        }

        AsyncFunction("buyPro") { () async -> [String: Any] in
            let store = await ProStore.shared
            let msg = await store.buy()
            let pro = await store.isPro
            return ["isPro": pro, "message": msg]
        }

        AsyncFunction("restorePro") { () async -> [String: Any] in
            let store = await ProStore.shared
            let msg = await store.restore()
            let pro = await store.isPro
            return ["isPro": pro, "message": msg]
        }
    }
}
