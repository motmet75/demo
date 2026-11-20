package com.anhmedia.portalweb.legacy;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import java.util.Optional;

/** /product/{endpoint} and /san-pham/{endpoint} (legacy single-product pages). */
@Controller
public class ProductRouteController {
    private final ProductPageRenderer renderer;

    public ProductRouteController(ProductPageRenderer renderer) {
        this.renderer = renderer;
    }

    @GetMapping({"/product/{endpoint}", "/product/{endpoint}/"})
    public Object product(@PathVariable String endpoint, Model model, HttpServletRequest request, HttpSession session) {
        return view(renderer.productPage(endpoint, request, session), model);
    }

    @GetMapping({"/san-pham/{endpoint}", "/san-pham/{endpoint}/"})
    public Object sanPham(@PathVariable String endpoint, Model model, HttpServletRequest request, HttpSession session) {
        return view(renderer.sanPhamPage(endpoint, request, session), model);
    }

    private static Object view(Optional<MenuPageRenderer.Page> page, Model model) {
        if (page.isEmpty()) return ResponseEntity.notFound().build(); // no tenant DB: Nginx -> 8080
        model.addAllAttributes(page.get().model());
        return page.get().view();
    }
}
