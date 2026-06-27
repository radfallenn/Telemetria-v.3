const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const androidRoot = path.join(root, 'android');
const pkg = 'com.studiorad.telemetriav3';
const pkgPath = path.join(androidRoot, 'app', 'src', 'main', 'java', ...pkg.split('.'));
const manifestPath = path.join(androidRoot, 'app', 'src', 'main', 'AndroidManifest.xml');
const mainActivityPath = path.join(pkgPath, 'MainActivity.java');

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }
function write(file, content) { ensureDir(path.dirname(file)); fs.writeFileSync(file, content); console.log('OK:', path.relative(root, file)); }
function patchFile(file, find, replace, label) {
  let text = fs.readFileSync(file, 'utf8');
  if (!text.includes(find)) {
    if (text.includes(replace)) { console.log('JA OK:', label); return; }
    throw new Error('Patch nao aplicado: ' + label);
  }
  text = text.replace(find, replace);
  fs.writeFileSync(file, text);
  console.log('OK:', label);
}

if (!fs.existsSync(manifestPath)) throw new Error('AndroidManifest nao encontrado. Rode npx cap add android antes.');
ensureDir(pkgPath);

let manifest = fs.readFileSync(manifestPath, 'utf8');
const perms = [
  'android.permission.INTERNET',
  'android.permission.ACCESS_NETWORK_STATE',
  'android.permission.WAKE_LOCK',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_DATA_SYNC',
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
  'android.permission.RECEIVE_BOOT_COMPLETED'
];
for (const p of perms) {
  const line = `<uses-permission android:name="${p}" />`;
  if (!manifest.includes(line)) manifest = manifest.replace('<application', `${line}\n    <application`);
}
if (!manifest.includes('TelemetryForegroundService')) {
  manifest = manifest.replace('</application>', `
        <service
            android:name=".TelemetryForegroundService"
            android:enabled="true"
            android:exported="false"
            android:foregroundServiceType="dataSync" />

        <receiver
            android:name=".TelemetryBootReceiver"
            android:enabled="true"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
                <action android:name="android.intent.action.MY_PACKAGE_REPLACED" />
            </intent-filter>
        </receiver>
    </application>`);
}
fs.writeFileSync(manifestPath, manifest);
console.log('OK: AndroidManifest background permissions/service');

write(path.join(pkgPath, 'TelemetryForegroundService.java'), `package ${pkg};

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import androidx.core.app.NotificationCompat;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import org.json.JSONObject;

public class TelemetryForegroundService extends Service {
    public static final String CHANNEL_ID = "gt7_telemetry_service";
    public static final int NOTIFICATION_ID = 33740;
    private Handler handler;
    private Runnable loop;
    private PowerManager.WakeLock wakeLock;
    private String lastLine = "Aguardando Bridge";

    @Override public void onCreate() {
        super.onCreate();
        createChannel();
        handler = new Handler(Looper.getMainLooper());
        acquireWakeLock();
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        startForeground(NOTIFICATION_ID, buildNotification("Serviço ativo", lastLine));
        startLoop();
        return START_STICKY;
    }

    private void startLoop() {
        if (loop != null) handler.removeCallbacks(loop);
        loop = new Runnable() {
            @Override public void run() {
                new Thread(() -> {
                    String title = "GT7 Telemetria ativo";
                    String text = pollBridge();
                    lastLine = text;
                    NotificationManager nm = (NotificationManager)getSystemService(NOTIFICATION_SERVICE);
                    nm.notify(NOTIFICATION_ID, buildNotification(title, text));
                }).start();
                handler.postDelayed(this, 5000);
            }
        };
        handler.post(loop);
    }

    private String bridgeUrl() {
        SharedPreferences sp = getSharedPreferences("gt7_background", MODE_PRIVATE);
        return sp.getString("bridge_url", "http://192.168.1.70:8787");
    }

    private String pollBridge() {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(bridgeUrl().replaceAll("/$", "") + "/api/fields");
            conn = (HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(2500);
            conn.setReadTimeout(2500);
            conn.setRequestMethod("GET");
            BufferedReader br = new BufferedReader(new InputStreamReader(conn.getInputStream()));
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = br.readLine()) != null) sb.append(line);
            br.close();
            JSONObject j = new JSONObject(sb.toString());
            int vel = (int)Math.round(j.optDouble("velocidade", 0));
            int rpm = (int)Math.round(j.optDouble("rpm", 0));
            String marcha = j.optString("marcha", "N");
            String last = j.optString("ultimaVolta", "--");
            String best = j.optString("melhorVolta", "--");
            int laps = Math.max(0, j.optInt("voltasCorrigidas", j.optInt("voltasCompletadas", 0)));
            return "🟢 " + vel + " km/h  RPM " + rpm + "  M" + marcha + " | Last " + last + " | Best " + best + " | Voltas " + laps;
        } catch (Exception e) {
            return "🟡 Serviço ativo — aguardando Bridge";
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private Notification buildNotification(String title, String text) {
        Intent open = new Intent(this, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        Intent stopIntent = new Intent(this, TelemetryForegroundService.class);
        stopIntent.setAction("STOP");
        PendingIntent stopPi = PendingIntent.getService(this, 1, stopIntent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(getApplicationInfo().icon)
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(text))
            .setContentIntent(pi)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .addAction(0, "Abrir", pi)
            .addAction(0, "Parar", stopPi)
            .build();
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(CHANNEL_ID, "GT7 Telemetria", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("Telemetria em segundo plano");
            NotificationManager nm = (NotificationManager)getSystemService(NOTIFICATION_SERVICE);
            nm.createNotificationChannel(ch);
        }
    }

    private void acquireWakeLock() {
        try {
            PowerManager pm = (PowerManager)getSystemService(POWER_SERVICE);
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "GT7Telemetria:BridgeWatch");
            wakeLock.setReferenceCounted(false);
            wakeLock.acquire(6 * 60 * 60 * 1000L);
        } catch (Exception ignored) {}
    }

    @Override public void onDestroy() {
        if (handler != null && loop != null) handler.removeCallbacks(loop);
        try { if (wakeLock != null && wakeLock.isHeld()) wakeLock.release(); } catch (Exception ignored) {}
        super.onDestroy();
    }

    @Override public IBinder onBind(Intent intent) { return null; }
}
`);

write(path.join(pkgPath, 'TelemetryBootReceiver.java'), `package ${pkg};

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

public class TelemetryBootReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        Intent service = new Intent(context, TelemetryForegroundService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(service);
        else context.startService(service);
    }
}
`);

write(mainActivityPath, `package ${pkg};

import android.Manifest;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        startTelemetryService();
        requestRuntimePermissions();
        requestBatteryOptimizationIgnore();
    }

    private void startTelemetryService() {
        Intent service = new Intent(this, TelemetryForegroundService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(service);
        else startService(service);
    }

    private void requestRuntimePermissions() {
        if (Build.VERSION.SDK_INT >= 33) {
            requestPermissions(new String[]{ Manifest.permission.POST_NOTIFICATIONS }, 1001);
        }
    }

    private void requestBatteryOptimizationIgnore() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PowerManager pm = (PowerManager)getSystemService(POWER_SERVICE);
                if (!pm.isIgnoringBatteryOptimizations(getPackageName())) {
                    Intent i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                    i.setData(Uri.parse("package:" + getPackageName()));
                    startActivity(i);
                }
            }
        } catch (Exception ignored) {}
    }
}
`);

// Ensure AndroidX core is available for NotificationCompat.
const gradlePath = path.join(androidRoot, 'app', 'build.gradle');
if (fs.existsSync(gradlePath)) {
  let gradle = fs.readFileSync(gradlePath, 'utf8');
  if (!gradle.includes('androidx.core:core')) {
    gradle = gradle.replace(/dependencies\s*\{/, "dependencies {\n    implementation 'androidx.core:core:1.13.1'");
    fs.writeFileSync(gradlePath, gradle);
    console.log('OK: androidx core dependency');
  }
}

console.log('Patch Android background concluido.');
