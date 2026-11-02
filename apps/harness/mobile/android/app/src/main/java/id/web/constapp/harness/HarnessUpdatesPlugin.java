package id.web.constapp.harness;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.*;
import java.net.*;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;

/** APK updates are opt-in installs; Android owns the permission and confirmation UI. */
@CapacitorPlugin(name = "HarnessUpdates")
public class HarnessUpdatesPlugin extends Plugin {
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private volatile boolean downloading = false;
    private volatile boolean installing = false;
    private volatile JSObject state = new JSObject().put("status", "idle");
    private File apk() { return new File(getContext().getCacheDir(), "harness-update.apk"); }
    private android.content.SharedPreferences prefs() { return getContext().getSharedPreferences("harness-update", 0); }
    private JSObject result(String status, String error) {
        JSObject value = new JSObject().put("status", status).put("version", prefs().getString("version", ""));
        if (error != null) value.put("error", error);
        state = value;
        notifyListeners("progress", value);
        return value;
    }
    private static String hex(byte[] bytes) { StringBuilder out = new StringBuilder(); for (byte b : bytes) out.append(String.format("%02x", b & 255)); return out.toString(); }
    private boolean validPackage(String version) throws Exception {
        PackageManager pm = getContext().getPackageManager();
        int flags = Build.VERSION.SDK_INT >= 28 ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
        PackageInfo current = pm.getPackageInfo(getContext().getPackageName(), flags);
        PackageInfo next = pm.getPackageArchiveInfo(apk().getAbsolutePath(), flags);
        if (next == null || !current.packageName.equals(next.packageName) || !version.equals(next.versionName)) return false;
        long oldCode = Build.VERSION.SDK_INT >= 28 ? current.getLongVersionCode() : current.versionCode;
        long newCode = Build.VERSION.SDK_INT >= 28 ? next.getLongVersionCode() : next.versionCode;
        if (newCode <= oldCode) return false;
        Signature[] oldSignatures = Build.VERSION.SDK_INT >= 28 ? current.signingInfo.getApkContentsSigners() : current.signatures;
        Signature[] newSignatures = Build.VERSION.SDK_INT >= 28 ? next.signingInfo.getApkContentsSigners() : next.signatures;
        return oldSignatures != null && newSignatures != null && oldSignatures.length > 0 && Arrays.equals(oldSignatures, newSignatures);
    }
    private String digest(File file) throws Exception {
        MessageDigest hash = MessageDigest.getInstance("SHA-256");
        try (InputStream stream = new FileInputStream(file)) { byte[] buffer = new byte[65536]; int count; while ((count = stream.read(buffer)) != -1) hash.update(buffer, 0, count); }
        return hex(hash.digest());
    }
    @PluginMethod public void getStatus(PluginCall call) {
        executor.execute(() -> {
            if (!downloading && apk().isFile()) {
                try { if (digest(apk()).equals(prefs().getString("sha256", "")) && validPackage(prefs().getString("version", ""))) result("ready", null); else { apk().delete(); result("idle", null); } }
                catch (Exception error) { apk().delete(); result("idle", null); }
            }
            call.resolve(state);
        });
    }
    @PluginMethod public synchronized void download(PluginCall call) {
        if (downloading || installing) { call.reject("UPDATE_IN_PROGRESS"); return; }
        String address = call.getString("url", ""), version = call.getString("version", ""), tag = call.getString("tag", ""), expected = call.getString("sha256", "");
        Long size = call.getLong("size");
        try {
            URI uri = new URI(address);
            if (!version.matches("\\d{1,9}\\.\\d{1,9}\\.\\d{1,9}") || !tag.equals("harness-v" + version) || !expected.matches("[a-f0-9]{64}") || size == null || size <= 0 || size > 2147483648L
                || !"https".equals(uri.getScheme()) || !"harness.const.web.id".equals(uri.getHost()) || (uri.getPort() != -1 && uri.getPort() != 443) || uri.getFragment() != null
                || !"/api/app-updates/download".equals(uri.getPath()) || uri.getRawQuery() == null || !uri.getRawQuery().matches("asset=\\d{1,16}&tag=" + java.util.regex.Pattern.quote(tag)) || uri.getUserInfo() != null) throw new Exception();
        } catch (Exception error) { call.reject("INVALID_RELEASE"); return; }
        downloading = true;
        executor.execute(() -> {
            File partial = new File(getContext().getCacheDir(), "harness-update.partial");
            HttpURLConnection connection = null;
            try {
                URL url = new URL(address);
                for (int redirects = 0; redirects < 8; redirects++) {
                    if (!"https".equals(url.getProtocol()) || !(url.getHost().equals("harness.const.web.id") || url.getHost().equals("release-assets.githubusercontent.com") || url.getHost().equals("objects.githubusercontent.com"))) throw new IOException();
                    connection = (HttpURLConnection) url.openConnection(); connection.setConnectTimeout(30000); connection.setReadTimeout(30000); connection.setInstanceFollowRedirects(false);
                    int status = connection.getResponseCode();
                    if (status >= 300 && status < 400) { String location = connection.getHeaderField("Location"); connection.disconnect(); if (location == null) throw new IOException(); url = new URL(url, location); continue; }
                    if (status != 200) throw new IOException();
                    break;
                }
                if (connection == null || connection.getResponseCode() != 200) throw new IOException();
                MessageDigest hash = MessageDigest.getInstance("SHA-256"); long received = 0; int previous = -1;
                try (InputStream input = connection.getInputStream(); OutputStream output = new FileOutputStream(partial)) {
                    byte[] buffer = new byte[65536]; int count;
                    while ((count = input.read(buffer)) != -1) {
                        if (Thread.currentThread().isInterrupted()) throw new IOException();
                        received += count; if (received > size) throw new SecurityException();
                        hash.update(buffer, 0, count); output.write(buffer, 0, count);
                        int percent = (int) (received * 100 / size);
                        if (percent != previous) { previous = percent; state = new JSObject().put("status", "downloading").put("progress", percent); notifyListeners("progress", state); }
                    }
                }
                if (received != size || !hex(hash.digest()).equals(expected)) throw new SecurityException();
                if (apk().exists() && !apk().delete()) throw new IOException();
                if (!partial.renameTo(apk())) throw new IOException();
                if (!validPackage(version)) { apk().delete(); throw new SecurityException(); }
                prefs().edit().putString("version", version).putString("sha256", expected).apply();
                call.resolve(result("ready", null));
            } catch (Exception error) { partial.delete(); call.resolve(result("error", error instanceof SecurityException ? "verification" : "download")); }
            finally { downloading = false; if (connection != null) connection.disconnect(); }
        });
    }
    @PluginMethod public synchronized void install(PluginCall call) {
        if (downloading || installing) { call.reject("UPDATE_IN_PROGRESS"); return; }
        installing = true;
        executor.execute(() -> {
            try {
                if (!apk().isFile() || !digest(apk()).equals(prefs().getString("sha256", "")) || !validPackage(prefs().getString("version", ""))) throw new SecurityException();
                getActivity().runOnUiThread(() -> {
                    try {
                        if (Build.VERSION.SDK_INT >= 26 && !getContext().getPackageManager().canRequestPackageInstalls()) {
                            getActivity().startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName())));
                            call.resolve(result("error", "permission")); return;
                        }
                        Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", apk());
                        Intent intent = new Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        getActivity().startActivity(intent);
                        call.resolve(result("ready", null));
                    } catch (Exception error) { call.resolve(result("error", "installation")); }
                    finally { installing = false; }
                });
            } catch (Exception error) { installing = false; call.resolve(result("error", "verification")); }
        });
    }
    @Override protected void handleOnDestroy() { executor.shutdownNow(); super.handleOnDestroy(); }
}
