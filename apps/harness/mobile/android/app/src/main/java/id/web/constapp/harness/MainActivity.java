package id.web.constapp.harness;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(HarnessUpdatesPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
