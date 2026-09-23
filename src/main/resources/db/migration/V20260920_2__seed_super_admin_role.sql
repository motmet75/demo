INSERT INTO authorities (username, authority, description, visible)
SELECT seed.username, 'ROLE_SUPER_ADMIN', 'Super administrator', TRUE
FROM (
    SELECT username FROM userTB WHERE username IN ('admin', 'anhmedia')
    UNION
    SELECT username FROM authorities WHERE username IN ('admin', 'anhmedia') AND authority = 'ROLE_ADMIN'
) seed
WHERE NOT EXISTS (
    SELECT 1 FROM authorities
    WHERE username = seed.username AND authority = 'ROLE_SUPER_ADMIN'
);
