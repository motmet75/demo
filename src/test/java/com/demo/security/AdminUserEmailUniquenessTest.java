package com.demo.security;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.ams.bomcore.domain.user.Authority;
import com.ams.bomcore.domain.user.User;
import com.ams.bomcore.repository.AuthorityRepository;
import com.ams.bomcore.repository.UserRepository;
import com.demo.invoicedesk.InvoiceDeskRoleAccessService;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

class AdminUserEmailUniquenessTest {
    private final UserRepository users=mock(UserRepository.class);
    private final AuthorityRepository authorities=mock(AuthorityRepository.class);
    private final PasswordEncoder encoder=mock(PasswordEncoder.class);
    private final NewUserNotificationService notifications=mock(NewUserNotificationService.class);
    private final InvoiceDeskRoleAccessService invoiceAccess=mock(InvoiceDeskRoleAccessService.class);
    private final AdminUserService service=new AdminUserService(
            users,authorities,encoder,notifications,invoiceAccess);

    private static AdminUserRequest request(String username,String email) {
        return new AdminUserRequest(username,"SecurePass123!","Test","User",email,true,
                List.of("ROLE_USER"),null,null);
    }

    @AfterEach void resetAuth() { SecurityContextHolder.clearContext(); }

    @Test void rejectsExistingEmailBeforeUserOrAuthoritiesAreWritten() {
        User existing=new User();
        existing.setId(42);
        existing.setUsername("existing");
        when(users.findByEmailIgnoreCase("vttcc@anhmedia.vn")).thenReturn(Optional.of(existing));

        ResponseStatusException error=assertThrows(ResponseStatusException.class,
                ()->service.createUser(request("newaccount"," VTTCC@anhmedia.vn ")));

        assertEquals(HttpStatus.CONFLICT,error.getStatusCode());
        assertTrue(error.getReason().contains("vttcc@anhmedia.vn"));
        verify(users,never()).saveAndFlush(any(User.class));
        verifyNoInteractions(notifications);
        verify(authorities,never()).deleteByUsername(anyString());
    }

    @Test void rejectsExistingEmailOnUpdateWithoutChangingExistingUser() {
        SecurityContextHolder.getContext().setAuthentication(
                new TestingAuthenticationToken("superadmin","password","ROLE_SUPER_ADMIN"));
        User target=new User();
        target.setId(2);
        target.setUsername("target");
        target.setEmail("old@anhmedia.vn");
        User other=new User();
        other.setId(3);
        other.setEmail("taken@anhmedia.vn");
        when(users.findById(2)).thenReturn(Optional.of(target));
        when(users.findByEmailIgnoreCase("taken@anhmedia.vn")).thenReturn(Optional.of(other));

        ResponseStatusException error=assertThrows(ResponseStatusException.class,
                ()->service.updateUser(2,request("target","taken@anhmedia.vn")));
        assertEquals(HttpStatus.CONFLICT,error.getStatusCode());
        assertEquals("old@anhmedia.vn",target.getEmail());
        verify(users,never()).saveAndFlush(any(User.class));
    }

    @Test void acceptsCaseOnlyEmailChangeForSameUserOnUpdate() {
        SecurityContextHolder.getContext().setAuthentication(
                new TestingAuthenticationToken("superadmin","password","ROLE_SUPER_ADMIN"));
        User target=new User();
        target.setId(9);
        target.setUsername("target");
        target.setEmail("Old@anhmedia.vn");
        when(users.findById(9)).thenReturn(Optional.of(target));
        when(users.findByEmailIgnoreCase("old@anhmedia.vn")).thenReturn(Optional.of(target));
        when(users.saveAndFlush(any(User.class))).thenAnswer(call->call.getArgument(0));
        when(authorities.findByUsername("target")).thenReturn(List.of());
        when(authorities.save(any(Authority.class))).thenAnswer(call->call.getArgument(0));

        service.updateUser(9,request("target","old@anhmedia.vn"));

        assertEquals("old@anhmedia.vn",target.getEmail());
        verify(users).saveAndFlush(same(target));
    }

    @Test void databaseRaceConflictReturnsFriendlyEmailErrorInsteadOfSqlException() {
        var controller=new AdminUserController(service);
        var response=controller.adminUserDatabaseConflict(new DataIntegrityViolationException(
                "ERROR: duplicate key value violates unique constraint \"usertb_email_key\""));
        assertEquals(HttpStatus.CONFLICT,response.getStatusCode());
        assertEquals("ADMIN_USER_EMAIL_DUPLICATE",response.getBody().get("code"));
        assertEquals("email",response.getBody().get("field"));
        assertFalse(String.valueOf(response.getBody().get("message")).contains("SQL"));
    }

    @Test void precheckedConflictHasReadableJsonMessage() {
        var controller=new AdminUserController(service);
        var response=controller.adminUserConflict(
                new ResponseStatusException(HttpStatus.CONFLICT,
                    "Email 'vttcc@anhmedia.vn' đã được sử dụng."));
        assertEquals(HttpStatus.CONFLICT,response.getStatusCode());
        assertEquals("email",response.getBody().get("field"));
        assertTrue(String.valueOf(response.getBody().get("message")).contains("vttcc@anhmedia.vn"));
    }
}
