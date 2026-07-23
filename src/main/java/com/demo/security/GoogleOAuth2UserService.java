package com.demo.security;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserService;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ams.bomcore.domain.company.Company;
import com.ams.bomcore.domain.tenant.Tenant;
import com.ams.bomcore.domain.user.Authority;
import com.ams.bomcore.domain.user.User;
import com.ams.bomcore.repository.AuthorityRepository;
import com.ams.bomcore.repository.CompanyRepository;
import com.ams.bomcore.repository.TenantRepository;
import com.ams.bomcore.repository.UserRepository;

@Service
public class GoogleOAuth2UserService implements OAuth2UserService<OAuth2UserRequest, OAuth2User> {

    private final UserRepository userRepository;
    private final TenantRepository tenantRepository;
    private final CompanyRepository companyRepository;
    private final AuthorityRepository authorityRepository;
    private final NewUserNotificationService newUserNotificationService;

    public GoogleOAuth2UserService(UserRepository userRepository,
                                   TenantRepository tenantRepository,
                                   CompanyRepository companyRepository,
                                   AuthorityRepository authorityRepository,
                                   NewUserNotificationService newUserNotificationService) {
        this.userRepository = userRepository;
        this.tenantRepository = tenantRepository;
        this.companyRepository = companyRepository;
        this.authorityRepository = authorityRepository;
        this.newUserNotificationService = newUserNotificationService;
    }

    @Override
    @Transactional
    public OAuth2User loadUser(OAuth2UserRequest userRequest) throws OAuth2AuthenticationException {
        DefaultOAuth2UserService delegate = new DefaultOAuth2UserService();
        OAuth2User oAuth2User = delegate.loadUser(userRequest);

        String email = oAuth2User.getAttribute("email");
        String firstName = oAuth2User.getAttribute("given_name");
        String lastName = oAuth2User.getAttribute("family_name");
        String picture = oAuth2User.getAttribute("picture");

        User user = userRepository.findByEmailIgnoreCase(email)
                .orElseGet(() -> createNewGoogleUser(email, firstName, lastName, picture));

        // Sync avatar if it changed
        if (picture != null && !picture.equals(user.getAvatar())) {
            user.setAvatar(picture);
            userRepository.save(user);
        }

        List<Authority> authorities = authorityRepository.findByUsername(user.getUsername());
        if (authorities.isEmpty()) {
            Authority auth = new Authority();
            auth.setUsername(user.getUsername());
            auth.setAuthority("ROLE_user");
            authorityRepository.save(auth);
            authorities = List.of(auth);
        }
        user.setAuthorities(authorities);
        return user;
    }

    private User createNewGoogleUser(String email, String firstName, String lastName, String picture) {
        String shortId = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        String displayName = (firstName != null && !firstName.isBlank()) ? firstName : email.split("@")[0];

        Tenant tenant = new Tenant();
        tenant.setTenantCode("shop-" + shortId);
        tenant.setTenantName(displayName + "'s Shop");
        tenant.setTenantType("SHOP_OWNER");
        tenant = tenantRepository.save(tenant);

        Company company = new Company();
        company.setTenant(tenant);
        company.setCompanyCode("co-" + shortId);
        company.setCompanyName(displayName + "'s Company");
        company.setValidUntil(Instant.now().plus(15, ChronoUnit.DAYS));
        company = companyRepository.save(company);

        User user = new User();
        user.setUsername(email);
        user.setEmail(email);
        user.setFirstName(firstName != null ? firstName : "");
        user.setLastName(lastName != null ? lastName : "");
        user.setAvatar(picture != null ? picture : "");
        user.setEnabled(true);
        user.setPassword("");
        user.setLastTenantId(tenant.getId().toString());
        user.setLastCompanyId(company.getId().toString());
        user.setAssignedTenantId(tenant.getId().toString());
        user.setAssignedCompanyId(company.getId().toString());
        User saved = userRepository.save(user);
        newUserNotificationService.notifyNewUser(saved, "google-oauth2");
        return saved;
    }
}
