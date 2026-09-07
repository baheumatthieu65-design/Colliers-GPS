package fr.paturgps.app;

import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);

        WindowInsetsControllerCompat controller =
                WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (controller != null) {
            controller.setAppearanceLightStatusBars(false);
            controller.setAppearanceLightNavigationBars(false);
        }

        View content = findViewById(android.R.id.content);
        if (content instanceof ViewGroup) {
            ViewGroup contentGroup = (ViewGroup) content;
            if (contentGroup.getChildCount() > 0) {
                View webView = contentGroup.getChildAt(0);
                FrameLayout root = new FrameLayout(this);
                root.setBackgroundColor(Color.BLACK);
                contentGroup.removeView(webView);
                root.addView(webView, new FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT));
                contentGroup.addView(root, new ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT));

                ViewCompat.setOnApplyWindowInsetsListener(root, (v, insets) -> {
                    Insets bars = insets.getInsets(WindowInsetsCompat.Type.statusBars());
                    FrameLayout.LayoutParams lp = (FrameLayout.LayoutParams) webView.getLayoutParams();
                    if (lp.topMargin != bars.top) {
                        lp.topMargin = bars.top;
                        webView.setLayoutParams(lp);
                    }
                    return insets;
                });
                ViewCompat.requestApplyInsets(root);
            }
        }
    }
}
