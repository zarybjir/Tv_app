package cz.videoteka.app

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.webkit.WebViewAssetLoader
import org.json.JSONArray
import org.json.JSONObject

/**
 * Videotéka v mobilu: stejná webová aplikace jako v televizi, běží ve WebView.
 * Most „VideotekaAndroid" jí dává seznam aplikací v telefonu, jejich spouštění
 * a otevírání odkazů (netflix.com/title/… otevře rovnou Netflix na titulu).
 */
class MainActivity : Activity() {

    private lateinit var webView: WebView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Stálá https adresa, aby localStorage (seznam, nastavení, klíče) přežil restart.
        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        webView = WebView(this)
        webView.setBackgroundColor(0xFF0B0D12.toInt())
        setContentView(webView)

        val s = webView.settings
        s.javaScriptEnabled = true
        s.domStorageEnabled = true
        s.allowFileAccess = false
        s.allowContentAccess = false
        s.textZoom = 100

        webView.addJavascriptInterface(Bridge(), "VideotekaAndroid")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                assetLoader.shouldInterceptRequest(request.url)

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val uri = request.url
                if (uri.host == HOST) return false
                openExternal(uri, null)
                return true
            }
        }

        webView.loadUrl(START_URL)
    }

    private fun openExternal(uri: Uri, pkg: String?): Boolean {
        if (!pkg.isNullOrEmpty()) {
            try {
                startActivity(Intent(Intent.ACTION_VIEW, uri).setPackage(pkg).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                return true
            } catch (e: ActivityNotFoundException) { /* aplikace odkaz neumí, zkus bez ní */ }
        }
        return try {
            startActivity(Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            true
        } catch (e: Exception) {
            false
        }
    }

    inner class Bridge {
        /** Aplikace v telefonu: [{"id": balíček, "name": název}] */
        @JavascriptInterface
        fun getApps(): String {
            val pm = packageManager
            val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
            val out = JSONArray()
            val seen = HashSet<String>()
            for (ri in pm.queryIntentActivities(intent, 0)) {
                val pkg = ri.activityInfo.packageName
                if (pkg == packageName || !seen.add(pkg)) continue
                out.put(JSONObject().put("id", pkg).put("name", ri.loadLabel(pm).toString()))
            }
            return out.toString()
        }

        @JavascriptInterface
        fun launch(pkg: String): Boolean {
            val intent = packageManager.getLaunchIntentForPackage(pkg) ?: return false
            return try {
                startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                true
            } catch (e: Exception) {
                false
            }
        }

        @JavascriptInterface
        fun openUrl(url: String, pkg: String): Boolean = openExternal(Uri.parse(url), pkg)

        @JavascriptInterface
        fun exit() {
            runOnUiThread { moveTaskToBack(true) }
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        webView.evaluateJavascript("window.videotekaBack ? (window.videotekaBack(), 1) : 0") { res ->
            if (res != "1") moveTaskToBack(true)
        }
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
        webView.evaluateJavascript("window.videotekaResume && window.videotekaResume();", null)
    }

    override fun onPause() {
        webView.onPause()
        super.onPause()
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }

    companion object {
        const val HOST = "appassets.androidplatform.net"
        const val START_URL = "https://$HOST/assets/web/index.html"
    }
}
