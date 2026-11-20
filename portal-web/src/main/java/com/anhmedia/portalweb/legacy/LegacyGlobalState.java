package com.anhmedia.portalweb.legacy;

import com.anhmedia.portalweb.legacy.entity.ProductColor;
import com.anhmedia.portalweb.legacy.entity.ProductPrice;
import com.anhmedia.portalweb.legacy.entity.ProductSize;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Process-wide state the legacy Portal keeps, reproduced so product pages
 * behave the same. (These are legacy design flaws, kept for parity.)
 *
 * 1. GreetingController fields shared by ALL visitors: currentColorString,
 *    colorRequeString and sizeRequeString. One visitor's ?color= / ?size=
 *    choice affects the price the next visitor sees.
 * 2. Sizes, colors and prices come from per-tenant caches that live for the
 *    whole 8080 process and are mutated in place by product pages
 *    (display flags; "allcolor" + price image on /san-pham/). Here the rows
 *    are re-read per request, so the recorded mutations are re-applied.
 */
@Component
public class LegacyGlobalState {
    public volatile String currentColorString = "none";
    public volatile String colorRequeString = "none";
    public volatile String sizeRequeString = "none";

    private final Map<String, String> colorDisplay = new ConcurrentHashMap<>();
    private final Map<String, String> sizeDisplay = new ConcurrentHashMap<>();
    private final Map<String, String> allColorPriceImage = new ConcurrentHashMap<>();

    private static String key(String tenant, Object id) { return tenant + "#" + id; }

    public void colorDisplay(String tenant, ProductColor color, String display) {
        color.setDisplay(display);
        colorDisplay.put(key(tenant, color.getId()), display == null ? "" : display);
    }

    public void sizeDisplay(String tenant, ProductSize size, String display) {
        size.setDisplay(display);
        sizeDisplay.put(key(tenant, size.getId()), display == null ? "" : display);
    }

    public void allColorPrice(String tenant, ProductPrice price, String priceImage) {
        price.setColorCode("allcolor");
        price.setPriceImage(priceImage);
        allColorPriceImage.put(key(tenant, price.getId()), priceImage == null ? "" : priceImage);
    }

    /** Re-apply every in-place mutation the legacy caches would still hold. */
    void reapply(String tenant, List<ProductSize> sizes, List<ProductColor> colors, List<ProductPrice> prices) {
        for (ProductColor c : colors) {
            String d = colorDisplay.get(key(tenant, c.getId()));
            if (d != null) c.setDisplay(d);
        }
        for (ProductSize s : sizes) {
            String d = sizeDisplay.get(key(tenant, s.getId()));
            if (d != null) s.setDisplay(d);
        }
        for (ProductPrice p : prices) {
            String image = allColorPriceImage.get(key(tenant, p.getId()));
            if (image != null) {
                p.setColorCode("allcolor");
                p.setPriceImage(image);
            }
        }
    }
}
