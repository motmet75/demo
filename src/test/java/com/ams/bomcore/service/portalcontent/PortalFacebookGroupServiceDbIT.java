package com.ams.bomcore.service.portalcontent;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.jdbc.core.JdbcTemplate;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * Against a scratch Postgres with usertb shaped like Hibernate's DDL (id without
 * default, hibernate_sequence). Opt-in via PORTAL_FBGROUP_IT_URL.
 */
@EnabledIfEnvironmentVariable(named = "PORTAL_FBGROUP_IT_URL", matches = "jdbc:postgresql:.*")
class PortalFacebookGroupServiceDbIT {
    @TempDir Path directory;

    private PortalFacebookGroupService service(JdbcTemplate[] out) throws Exception {
        Files.writeString(directory.resolve("t.properties"), "id=shop.test\nurl=" + System.getenv("PORTAL_FBGROUP_IT_URL")
                + "\nusername=test\npassword=\n");
        var registry = new PortalTenantDataSourceRegistry(List.of(directory));
        JdbcTemplate db = new JdbcTemplate(registry.dataSource("shop.test"));
        db.execute("DROP TABLE IF EXISTS usergrouptb, marketinggrouptb, usertb; DROP SEQUENCE IF EXISTS hibernate_sequence");
        db.execute("""
                CREATE SEQUENCE hibernate_sequence START 100;
                CREATE TABLE usertb (id integer NOT NULL PRIMARY KEY, username varchar(255) NOT NULL UNIQUE,
                  password varchar(255) NOT NULL, firstname varchar(255), lastname varchar(255), avarta varchar(255),
                  email varchar(255), isaccountnonexpired boolean NOT NULL, isaccountnonlocked boolean NOT NULL,
                  iscredentialsnonexpired boolean NOT NULL, isallowmarketing boolean NOT NULL, mailquota integer,
                  uploadquota integer, japaneselearningquota integer NOT NULL, titleandhonorific varchar(255),
                  phonenumber varchar(255), createdtime timestamp, isenabled boolean NOT NULL,
                  validationcode varchar(255), leaderid integer, assignedtenantid varchar(255) NOT NULL);
                CREATE TABLE marketinggrouptb (id bigserial PRIMARY KEY, stringid varchar(255) NOT NULL UNIQUE,
                  groupname varchar(255), createdtime timestamp);
                CREATE TABLE usergrouptb (id bigserial PRIMARY KEY, userid bigint NOT NULL, groupid bigint NOT NULL,
                  username varchar(255) NOT NULL, groupstringid varchar(255) NOT NULL, createdtime timestamp,
                  UNIQUE (username, groupstringid));
                INSERT INTO usertb (id, username, password, isaccountnonexpired, isaccountnonlocked, iscredentialsnonexpired,
                  isallowmarketing, japaneselearningquota, isenabled, assignedtenantid)
                  VALUES (5, 'facebook.com/groups/old.group/', 'x', true, true, true, true, 0, true, ''),
                         (6, 'abc', 'y', true, true, true, false, 0, true, '');
                INSERT INTO marketinggrouptb (stringid, groupname) VALUES ('sale', 'Nhóm sale');
                """);
        out[0] = db;
        return new PortalFacebookGroupService(registry);
    }

    @Test
    void storesNewGroupsLinksExistingOnesAndReportsBadLines() throws Exception {
        JdbcTemplate[] ref = new JdbcTemplate[1];
        var service = service(ref);
        JdbcTemplate db = ref[0];
        var result = service.add("shop.test", new PortalFacebookGroupService.AddRequest("""
                Nội thất giá rẻ | https://www.facebook.com/groups/noithat/?ref=share
                https://m.facebook.com/groups/noithat/permalink/1
                https://www.facebook.com/groups/old.group
                https://www.facebook.com/groups/abc
                https://www.facebook.com/share/g/xyz/
                """, "sale", ""));
        assertEquals(List.of("https://www.facebook.com/groups/noithat", "https://www.facebook.com/groups/abc"), result.created());
        assertEquals(List.of("facebook.com/groups/old.group/"), result.linked());   // same group, kept its stored form
        assertEquals(1, result.invalid().size());

        Map<String, Object> u = db.queryForMap("SELECT * FROM usertb WHERE username = 'https://www.facebook.com/groups/noithat'");
        assertEquals("Nội thất giá rẻ", u.get("firstname"));
        assertEquals(false, u.get("isenabled"));                                    // not a login account
        assertEquals(PortalFacebookGroupService.NOT_A_LOGIN_PASSWORD, u.get("password"));
        assertEquals(true, u.get("isallowmarketing"));
        assertEquals("", u.get("assignedtenantid"));                                // unknown NOT NULL column filled
        assertEquals(100, u.get("id"));                                             // from hibernate_sequence
        assertEquals("Facebook group abc", db.queryForObject("SELECT firstname FROM usertb WHERE id = 101", String.class));
        assertEquals(3, db.queryForObject("SELECT count(*) FROM usergrouptb WHERE groupstringid = 'sale'", Integer.class));

        var again = service.add("shop.test", new PortalFacebookGroupService.AddRequest(
                "https://facebook.com/groups/noithat", "sale", ""));
        assertEquals(List.of("https://www.facebook.com/groups/noithat"), again.already());
        assertEquals(3, db.queryForObject("SELECT count(*) FROM usergrouptb", Integer.class));
    }

    @Test
    void createsOrReusesAMarketingGroupByName() throws Exception {
        JdbcTemplate[] ref = new JdbcTemplate[1];
        var service = service(ref);
        var r1 = service.add("shop.test", new PortalFacebookGroupService.AddRequest("123456789", "", "Nhóm nội thất HCM"));
        assertEquals("fb-nhom-noi-that-hcm", r1.marketingGroupId());
        var r2 = service.add("shop.test", new PortalFacebookGroupService.AddRequest("987654321", "", "nhóm nội thất hcm"));
        assertEquals("fb-nhom-noi-that-hcm", r2.marketingGroupId());
        assertEquals(2, ref[0].queryForObject("SELECT count(*) FROM usergrouptb WHERE groupstringid = 'fb-nhom-noi-that-hcm'", Integer.class));
        assertThrows(IllegalArgumentException.class, () -> service.add("shop.test",
                new PortalFacebookGroupService.AddRequest("123456789", "missing", "")));
        assertThrows(IllegalArgumentException.class, () -> service.add("shop.test",
                new PortalFacebookGroupService.AddRequest("123456789", "", "")));
    }
}
