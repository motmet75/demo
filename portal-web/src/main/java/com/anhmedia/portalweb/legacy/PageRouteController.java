package com.anhmedia.portalweb.legacy;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.Optional;

/** Phase 3 routes: article pages, Vietnamese/English static pages and the login page. */
@Controller
public class PageRouteController {
    private final ArticlePageRenderer articles;
    private final StaticPagesRenderer pages;

    public PageRouteController(ArticlePageRenderer articles, StaticPagesRenderer pages) {
        this.articles = articles;
        this.pages = pages;
    }

    private static Object view(Optional<MenuPageRenderer.Page> page, Model model) {
        if (page.isEmpty()) return ResponseEntity.notFound().build(); // no tenant DB: Nginx -> 8080
        model.addAllAttributes(page.get().model());
        return page.get().view();
    }

    // ---- /article/{x}, /bai-viet/{x}, /blog/{x} ----

    @GetMapping({"/article/{endpoint}", "/article/{endpoint}/"})
    public Object article(@PathVariable String endpoint, Model model, HttpServletRequest r, HttpSession s) {
        return view(articles.render(endpoint, "article", r, s), model);
    }

    @GetMapping({"/bai-viet/{endpoint}", "/bai-viet/{endpoint}/"})
    public Object baiViet(@PathVariable String endpoint, Model model, HttpServletRequest r, HttpSession s) {
        return view(articles.render(endpoint, "bai-viet", r, s), model);
    }

    @GetMapping({"/blog/{endpoint}", "/blog/{endpoint}/"})
    public Object blogArticle(@PathVariable String endpoint, Model model, HttpServletRequest r, HttpSession s) {
        return view(articles.render(endpoint, "bai-viet", r, s), model);
    }

    // ---- about / contact / videos ----

    @GetMapping("/gioi-thieu.html")
    public Object gioiThieu(Model model, HttpServletRequest r, HttpSession s) {
        return view(pages.about("gioi-thieu.html", r, s), model);
    }

    @GetMapping("/about.html")
    public Object about(Model model, HttpServletRequest r, HttpSession s) {
        return view(pages.about("about.html", r, s), model);
    }

    @GetMapping("/contact.html")
    public Object contact(@RequestParam(required = false) String templateLink, Model model, HttpServletRequest r, HttpSession s) {
        return view(pages.contact(templateLink, r, s), model);
    }

    @GetMapping("/lien-he.html")
    public Object lienHe(Model model, HttpServletRequest r, HttpSession s) {
        return view(pages.contact("lien-he.html", r, s), model);
    }

    @GetMapping("/videos.html")
    public Object videos(@RequestParam(defaultValue = "1") int page, @RequestParam(required = false) String templateLink,
                         Model model, HttpServletRequest r, HttpSession s) {
        return view(pages.videos(page, templateLink, r, s), model);
    }

    // ---- marine / tin-tuc / blog listings ----

    @GetMapping("/marine.html")
    public Object marine(@RequestParam(defaultValue = "1") int page, Model model, HttpServletRequest r, HttpSession s) {
        return view(pages.articleList(page, "marine", "marine.html", r, s), model);
    }

    @GetMapping("/tin-tuc.html")
    public Object tinTuc(@RequestParam(defaultValue = "1") int page, Model model, HttpServletRequest r, HttpSession s) {
        return view(pages.articleList(page, "tin-tuc", "tin-tuc.html", r, s), model);
    }

    @GetMapping("/bai-viet.html")
    public Object baiVietList(@RequestParam(defaultValue = "1") int page, Model model, HttpServletRequest r, HttpSession s) {
        return view(pages.blog(page, "bai-viet", "bai-viet.html", r, s), model);
    }

    @GetMapping("/article.html")
    public Object articleList(@RequestParam(defaultValue = "1") int page, Model model, HttpServletRequest r, HttpSession s) {
        return view(pages.blog(page, "article", "article.html", r, s), model);
    }

    @GetMapping("/blog.html")
    public Object blogList(@RequestParam(defaultValue = "1") int page, @RequestParam(required = false) String midpath,
                           @RequestParam(required = false) String templateLink, Model model, HttpServletRequest r, HttpSession s) {
        return view(pages.blog(page, midpath, templateLink, r, s), model);
    }

    // ---- content pages (policies, knowledge center, guides) ----

    @GetMapping("/privacy-policy.html")
    public Object privacy(Model model, HttpServletRequest r, HttpSession s) {
        return view(pages.contentPage("privacy-policy.html", "Privacy Policy | Tuong Hoa ImEx",
                "How Tuong Hoa ImEx collects, uses, protects, and shares website visitor and customer inquiry information.",
                "privacy policy, personal data, cookies, Tuong Hoa ImEx", r, s), model);
    }

    @GetMapping("/terms-of-service.html")
    public Object terms(Model model, HttpServletRequest r, HttpSession s) {
        return view(pages.contentPage("terms-of-service.html", "Terms and Conditions | Tuong Hoa ImEx",
                "Website terms for using Tuong Hoa ImEx information, quotations, import-export consulting, and engine sourcing services.",
                "terms and conditions, website terms, Tuong Hoa ImEx", r, s), model);
    }

    @GetMapping("/shipping-policy.html")
    public Object shipping(Model model, HttpServletRequest r, HttpSession s) {
        return view(pages.contentPage("shipping-policy.html", "Shipping Policy | Tuong Hoa ImEx",
                "How Tuong Hoa ImEx handles packing, documentation, freight coordination, delivery timing, and customs responsibilities for engines and industrial equipment.",
                "shipping policy, freight, engine delivery, customs clearance, import export", r, s), model);
    }

    @GetMapping("/return-policy.html")
    public Object returns(Model model, HttpServletRequest r, HttpSession s) {
        return view(pages.contentPage("return-policy.html", "Return Policy | Tuong Hoa ImEx",
                "Return, inspection, warranty, and claim handling terms for used engines, parts, and import-export service orders.",
                "return policy, refund policy, used marine engine warranty, Tuong Hoa ImEx", r, s), model);
    }

    @GetMapping("/knowledge-center.html")
    public Object knowledge(Model model, HttpServletRequest r, HttpSession s) {
        return view(pages.contentPage("knowledge-center.html", "Engine Import and Maintenance Knowledge Center | Tuong Hoa ImEx",
                "Original guides on choosing, inspecting, importing, and maintaining marine diesel engines and industrial equipment.",
                "marine diesel engine guide, used engine inspection, import procedure Vietnam, engine maintenance", r, s), model);
    }

    @GetMapping({"/guides/how-to-choose-marine-diesel-engine.html", "/guides/mitsubishi-vs-yanmar-marine-engines.html",
            "/guides/used-marine-engine-inspection-checklist.html", "/guides/marine-engine-maintenance-schedule.html",
            "/guides/import-used-machinery-vietnam.html", "/guides/engine-specifications-explained.html"})
    public Object guide(Model model, HttpServletRequest r, HttpSession s) {
        String template = r.getRequestURI();
        while (template.startsWith("/")) template = template.substring(1);
        return view(pages.contentPage(template, guideTitle(template), guideDescription(template),
                "marine diesel engine, engine import, engine maintenance, customs clearance, used machinery", r, s), model);
    }

    private static String guideTitle(String t) {
        return switch (t) {
            case "guides/how-to-choose-marine-diesel-engine.html" -> "How to Choose a Marine Diesel Engine | Tuong Hoa ImEx";
            case "guides/mitsubishi-vs-yanmar-marine-engines.html" -> "Mitsubishi vs Yanmar Marine Engines | Tuong Hoa ImEx";
            case "guides/used-marine-engine-inspection-checklist.html" -> "Used Marine Engine Inspection Checklist | Tuong Hoa ImEx";
            case "guides/marine-engine-maintenance-schedule.html" -> "Marine Engine Maintenance Schedule | Tuong Hoa ImEx";
            case "guides/import-used-machinery-vietnam.html" -> "Importing Used Machinery into Vietnam | Tuong Hoa ImEx";
            case "guides/engine-specifications-explained.html" -> "Engine Specifications Explained | Tuong Hoa ImEx";
            default -> "Engine Knowledge Guide | Tuong Hoa ImEx";
        };
    }

    private static String guideDescription(String t) {
        return switch (t) {
            case "guides/how-to-choose-marine-diesel-engine.html" -> "A practical buying guide for matching marine diesel engine power, duty cycle, gearbox, cooling, documentation, and service support to a real vessel.";
            case "guides/mitsubishi-vs-yanmar-marine-engines.html" -> "A practical comparison of Mitsubishi and Yanmar marine engines for buyers evaluating reliability, parts support, operating profile, and used-engine inspection.";
            case "guides/used-marine-engine-inspection-checklist.html" -> "A step-by-step used marine engine inspection checklist covering documents, visual checks, compression, oil, cooling, sea trial, and logistics.";
            case "guides/marine-engine-maintenance-schedule.html" -> "A maintenance schedule for marine diesel engines covering daily checks, service intervals, fuel, oil, cooling, belts, batteries, and records.";
            case "guides/import-used-machinery-vietnam.html" -> "An import procedure guide for used engines and machinery entering Vietnam, including documents, HS codes, inspection, customs clearance, and delivery planning.";
            case "guides/engine-specifications-explained.html" -> "A plain-English guide to engine specifications such as horsepower, kilowatts, RPM, torque, SFOC, displacement, serial plates, and dimensions.";
            default -> "Original guide from Tuong Hoa ImEx on engines, import-export procedures, and maintenance planning.";
        };
    }

    // ---- login page (the login itself is a POST and stays on Portal 8080) ----

    @GetMapping("/dang-nhap")
    public Object login(Model model, HttpServletRequest r, HttpSession s) {
        return view(pages.login(r, s), model);
    }
}
