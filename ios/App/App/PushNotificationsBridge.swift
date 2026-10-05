
import Foundation
import Capacitor
import UserNotifications

@objc(PushNotificationsBridge)
public class PushNotificationsBridge: CAPPlugin {
    
    override public func load() {
        super.load()
        setupWebViewBridge()
    }
    
    private func setupWebViewBridge() {
        // Adicionar handler para mensagens do WebView
        DispatchQueue.main.async {
            if let webView = self.bridge?.webView {
                let userContentController = webView.configuration.userContentController
                userContentController.add(self, name: "pushNotifications")
            }
        }
    }
    
    @objc func requestPermission(_ call: CAPPluginCall) {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
            DispatchQueue.main.async {
                if granted {
                    UIApplication.shared.registerForRemoteNotifications()
                    self.sendMessageToWebView(type: "pushPermission", data: ["status": "granted"])
                } else {
                    self.sendMessageToWebView(type: "pushPermission", data: ["status": "denied"])
                }
            }
        }
        call.resolve()
    }
    
    private func sendMessageToWebView(type: String, data: [String: Any]) {
        let message = ["type": type, "data": data]
        if let jsonData = try? JSONSerialization.data(withJSONObject: message),
           let jsonString = String(data: jsonData, encoding: .utf8) {
            DispatchQueue.main.async {
                self.bridge?.webView?.evaluateJavaScript("window.postMessage(\(jsonString), '*');")
            }
        }
    }
    
    // Método para receber token do AppDelegate
    public func setDeviceToken(_ token: String) {
        sendMessageToWebView(type: "pushToken", data: ["token": token])
    }
}

extension PushNotificationsBridge: WKScriptMessageHandler {
    public func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any],
              let type = body["type"] as? String else { return }
        
        switch type {
        case "initialize":
            checkPermissionStatus()
        case "requestPermission":
            requestPermission(CAPPluginCall(callbackId: "", options: [:], success: { _ in }, error: { _ in }))
        default:
            break
        }
    }
    
    private func checkPermissionStatus() {
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            var status = "prompt"
            switch settings.authorizationStatus {
            case .authorized, .provisional:
                status = "granted"
            case .denied:
                status = "denied"
            case .notDetermined:
                status = "prompt"
            @unknown default:
                status = "prompt"
            }
            
            DispatchQueue.main.async {
                self.sendMessageToWebView(type: "pushPermission", data: ["status": status])
            }
        }
    }
}
