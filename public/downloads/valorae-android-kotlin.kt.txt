package app.valorae.integration

import java.net.HttpURLConnection
import java.net.URL

class ValoraeProxyClient(
    private val baseUrl: String = "https://servidor-valorae.vercel.app",
    private val timeoutMs: Int = 12000
) {
    fun get(path: String): String {
        val url = URL(baseUrl.trimEnd('/') + path)
        val conn = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = timeoutMs
            readTimeout = timeoutMs
            setRequestProperty("Accept", "application/json")
        }
        return try {
            val stream = if (conn.responseCode in 200..299) conn.inputStream else conn.errorStream
            stream.bufferedReader().use { it.readText() }
        } finally {
            conn.disconnect()
        }
    }

    fun health(): String = get("/api/health")
    fun ready(): String = get("/api/ready")
    fun asset(ticker: String): String = get("/api/asset?ticker=$ticker")
    fun assets(tickers: List<String>): String = get("/api/assets?tickers=" + tickers.joinToString(","))
    fun metrics(): String = get("/api/server/metrics")
}
