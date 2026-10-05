
import UIKit
import UserNotifications
import WebKit

class PushNotificationManager: NSObject, UNUserNotificationCenterDelegate {
    static let shared = PushNotificationManager()
    private weak var webView: WKWebView?
    private var deviceToken: String?
    
    override init() {
        super.init()
        UNUserNotificationCenter.current().delegate = self
    }
    
    // MARK: - Public Methods
    
    func registerForPushNotifications() {
        print("🔔 Solicitando permissões para notificações...")
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
            print("🔔 Permissão para notificações: \(granted)")
            if let error = error {
                print("❌ Erro ao solicitar permissão: \(error)")
                self.sendPermissionStatusToWebView(status: "denied", error: error.localizedDescription)
                return
            }
            
            if granted {
                DispatchQueue.main.async {
                    UIApplication.shared.registerForRemoteNotifications()
                    self.sendPermissionStatusToWebView(status: "granted")
                }
            } else {
                print("❌ Permissão negada pelo usuário")
                self.sendPermissionStatusToWebView(status: "denied")
            }
        }
    }
    
    func checkPermissionStatus() {
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
            
            print("🔍 Status atual das permissões: \(status)")
            self.sendPermissionStatusToWebView(status: status)
        }
    }
    
    func setWebView(_ webView: WKWebView) {
        self.webView = webView
        print("🌐 WebView configurada no PushNotificationManager")
        
        // Verificar status atual das permissões
        checkPermissionStatus()
        
        // Se já temos um token, injetar imediatamente
        injectTokenIfAvailable()
        
        // Configurar message handler para receber mensagens do WebView
        webView.configuration.userContentController.add(self, name: "iosNotifications")
    }
    
    func injectTokenIfAvailable() {
        guard let webView = self.webView, let token = self.deviceToken else {
            print("⚠️ WebView ou token não disponível para injeção")
            return
        }
        
        let script = """
            localStorage.setItem('deviceToken', '\(token)');
            localStorage.setItem('isRegistered', 'true');
            localStorage.setItem('deviceSource', 'ios_native');
            
            // Disparar evento customizado para o React
            window.dispatchEvent(new CustomEvent('deviceTokenReceived', {
                detail: {
                    token: '\(token)',
                    source: 'ios_native'
                }
            }));
            
            console.log('📱 Token nativo injetado pelo iOS:', '\(token.prefix(20))...');
        """
        
        webView.evaluateJavaScript(script) { result, error in
            if let error = error {
                print("❌ Erro ao injetar token: \(error)")
            } else {
                print("✅ Token injetado com sucesso no WebView")
            }
        }
    }
    
    private func sendPermissionStatusToWebView(status: String, error: String? = nil) {
        guard let webView = self.webView else {
            print("⚠️ WebView não disponível para enviar status")
            return
        }
        
        let errorPart = error != nil ? ", error: '\(error!)'" : ""
        let script = """
            window.dispatchEvent(new CustomEvent('pushPermissionStatus', {
                detail: {
                    status: '\(status)'\(errorPart)
                }
            }));
            console.log('🔔 Status de permissão enviado para React:', '\(status)');
        """
        
        DispatchQueue.main.async {
            webView.evaluateJavaScript(script) { result, error in
                if let error = error {
                    print("❌ Erro ao enviar status para WebView: \(error)")
                } else {
                    print("✅ Status de permissão enviado para WebView")
                }
            }
        }
    }
    
    // MARK: - AppDelegate Methods
    
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        let tokenParts = deviceToken.map { data in String(format: "%02.2hhx", data) }
        let token = tokenParts.joined()
        self.deviceToken = token
        
        print("📱 Device Token APNs recebido: \(token.prefix(20))...")
        
        // Enviar para Supabase
        sendDeviceTokenToSupabase(token: token)
        
        // Injetar no WebView se disponível
        injectTokenIfAvailable()
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        print("❌ Falha ao registrar para notificações: \(error)")
        sendPermissionStatusToWebView(status: "denied", error: error.localizedDescription)
    }
    
    // MARK: - Private Methods
    
    private func sendDeviceTokenToSupabase(token: String) {
        guard let url = URL(string: "https://jwddiyuezqrpuakazvgg.supabase.co/functions/v1/register-device") else {
            print("❌ URL inválida")
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")
        request.addValue("Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3ZGRpeXVlenFycHVha2F6dmdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEzNDIzNTgsImV4cCI6MjA2NjkxODM1OH0.CrUu3HGCfWh6cPfGsbDXGQNG5AWOsi9X2GGix1-7izg", forHTTPHeaderField: "Authorization")
        
        let json: [String: String] = ["token": token]
        
        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: json)
        } catch {
            print("❌ Erro ao serializar JSON: \(error)")
            return
        }

        URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                print("❌ Erro ao enviar token para Supabase: \(error)")
                return
            }
            
            if let httpResponse = response as? HTTPURLResponse {
                print("📡 Resposta do Supabase: \(httpResponse.statusCode)")
                if httpResponse.statusCode == 200 {
                    print("✅ Token enviado para Supabase com sucesso")
                } else {
                    print("⚠️ Status code inesperado: \(httpResponse.statusCode)")
                }
            }
            
            if let data = data, let responseString = String(data: data, encoding: .utf8) {
                print("📄 Resposta do servidor: \(responseString)")
            }
        }.resume()
    }
    
    // MARK: - UNUserNotificationCenterDelegate
    
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        // Mostrar notificação mesmo quando o app está aberto
        completionHandler([.banner, .sound, .badge])
    }
    
    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler completionHandler: @escaping () -> Void) {
        print("👆 Usuário tocou na notificação: \(response.notification.request.content.body)")
        completionHandler()
    }
}

// MARK: - WKScriptMessageHandler
extension PushNotificationManager: WKScriptMessageHandler {
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any],
              let type = body["type"] as? String else {
            print("⚠️ Mensagem inválida recebida do WebView")
            return
        }
        
        print("📨 Mensagem recebida do WebView: \(type)")
        
        switch type {
        case "requestPermission":
            registerForPushNotifications()
        case "checkPermission":
            checkPermissionStatus()
        case "sendTestNotification":
            if let title = body["title"] as? String,
               let message = body["message"] as? String {
                // Aqui você pode implementar envio de teste local se necessário
                print("🧪 Teste solicitado: \(title) - \(message)")
            }
        default:
            print("⚠️ Tipo de mensagem não reconhecido: \(type)")
        }
    }
}
