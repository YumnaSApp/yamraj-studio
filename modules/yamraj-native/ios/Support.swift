import Foundation
import UIKit
import PhotosUI
import AVFoundation
import StoreKit

// MARK: - Files on disk

enum FileStore {
    static var documents: URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    }
    static var caches: URL {
        FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
    }
    private static func folder(_ base: URL, _ name: String) -> URL {
        let url = base.appendingPathComponent(name, isDirectory: true)
        try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }
    static var audio: URL  { folder(documents, "Audio") }
    static var videos: URL { folder(documents, "Videos") }
    static var images: URL { folder(documents, "Images") }
    static var synth: URL  { folder(caches, "Synth") }
    static var temp: URL   { folder(caches, "Temp") }

    static func delete(_ url: URL) { try? FileManager.default.removeItem(at: url) }

    /// Accepts "file://…", an absolute path, or a name relative to Documents.
    static func resolve(_ path: String) -> URL {
        if path.hasPrefix("file://"), let u = URL(string: path) { return u }
        if path.hasPrefix("/") { return URL(fileURLWithPath: path) }
        return documents.appendingPathComponent(path)
    }
}

// MARK: - Clip player

final class ClipPlayer: NSObject, AVAudioPlayerDelegate {
    static let shared = ClipPlayer()
    private var player: AVAudioPlayer?

    func play(_ url: URL) throws {
        stop()
        SpeechEngine.activateSession()
        let p = try AVAudioPlayer(contentsOf: url)
        p.delegate = self
        p.play()
        player = p
    }

    func stop() {
        player?.stop()
        player = nil
    }

    func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        self.player = nil
    }
}

// MARK: - Photo picker

final class ImagePicker: NSObject, PHPickerViewControllerDelegate {
    private var continuation: CheckedContinuation<String?, Never>?
    private static var current: ImagePicker?

    @MainActor
    static func pick(from presenter: UIViewController?) async -> String? {
        guard let presenter else { return nil }
        let picker = ImagePicker()
        current = picker
        return await withCheckedContinuation { cont in
            picker.continuation = cont
            var config = PHPickerConfiguration()
            config.filter = .images
            config.selectionLimit = 1
            let vc = PHPickerViewController(configuration: config)
            vc.delegate = picker
            presenter.present(vc, animated: true)
        }
    }

    func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
        picker.dismiss(animated: true)
        guard let provider = results.first?.itemProvider, provider.canLoadObject(ofClass: UIImage.self) else {
            finish(nil); return
        }
        provider.loadObject(ofClass: UIImage.self) { [weak self] obj, _ in
            guard let image = obj as? UIImage, let data = image.jpegData(compressionQuality: 0.9) else {
                self?.finish(nil); return
            }
            let name = "Images/img_\(UUID().uuidString).jpg"
            _ = FileStore.images
            let url = FileStore.documents.appendingPathComponent(name)
            do { try data.write(to: url); self?.finish(name) } catch { self?.finish(nil) }
        }
    }

    private func finish(_ value: String?) {
        continuation?.resume(returning: value)
        continuation = nil
        ImagePicker.current = nil
    }
}

// MARK: - In-app purchase (Yamraj Studio Pro)

@MainActor
final class ProStore {
    static let shared = ProStore()
    static let proID = "com.kamran.yamrajstudio.pro"

    private(set) var isPro = false
    private(set) var product: Product?
    private var updates: Task<Void, Never>?

    private init() {
        updates = Task { [weak self] in
            for await result in Transaction.updates {
                if case .verified(let t) = result {
                    await t.finish()
                    await self?.refresh()
                }
            }
        }
    }

    func load() async {
        product = try? await Product.products(for: [Self.proID]).first
        await refresh()
    }

    func refresh() async {
        var pro = false
        for await result in Transaction.currentEntitlements {
            if case .verified(let t) = result, t.productID == Self.proID, t.revocationDate == nil { pro = true }
        }
        isPro = pro
    }

    /// Returns a short message for the UI.
    func buy() async -> String {
        if product == nil { await load() }
        guard let product else { return "Pro is not set up in App Store Connect yet." }
        do {
            switch try await product.purchase() {
            case .success(let v):
                if case .verified(let t) = v {
                    await t.finish()
                    await refresh()
                    return "👑 You are Pro now! Thank you."
                }
                return "Purchase could not be verified."
            case .pending: return "Purchase is pending approval."
            case .userCancelled: return ""
            @unknown default: return ""
            }
        } catch {
            return error.localizedDescription
        }
    }

    func restore() async -> String {
        try? await AppStore.sync()
        await refresh()
        return isPro ? "👑 Pro restored." : "No Pro purchase found on this Apple ID."
    }
}
