-- VTTCC login seed. Password is stored as a BCrypt $2B strength-13 hash.
BEGIN;

INSERT INTO usertb (
    username, password, firstname, lastname, email,
    isaccountnonexpired, isaccountnonlocked, iscredentialsnonexpired,
    isallowmarketing, isenabled, createdtime, validationcode, leaderid,
    lasttenantid, lastcompanyid, assignedtenantid, assignedcompanyid
)
VALUES (
    'vttcc',
    '$2b$13$k/OFul6VEd6rUAp0sOOgeu6lWW89CJf2nZxkAoztfdn/oHBkkpOwK',
    'VTTCC', 'Camera Service', 'vttcc@anhmedia.vn',
    TRUE, TRUE, TRUE, FALSE, TRUE, NOW(), '', 0,
    (SELECT id::text FROM tenant WHERE tenant_code='vttcc2026'),
    '0198f600-0000-7000-8000-000000000002',
    (SELECT id::text FROM tenant WHERE tenant_code='vttcc2026'),
    '0198f600-0000-7000-8000-000000000002'
)
ON CONFLICT (username) DO UPDATE SET
    password=EXCLUDED.password,
    firstname=EXCLUDED.firstname,
    lastname=EXCLUDED.lastname,
    email=EXCLUDED.email,
    isaccountnonexpired=TRUE,
    isaccountnonlocked=TRUE,
    iscredentialsnonexpired=TRUE,
    isenabled=TRUE,
    lasttenantid=EXCLUDED.lasttenantid,
    lastcompanyid=EXCLUDED.lastcompanyid,
    assignedtenantid=EXCLUDED.assignedtenantid,
    assignedcompanyid=EXCLUDED.assignedcompanyid;

INSERT INTO authorities (username, authority, description, visible)
SELECT 'vttcc', 'ROLE_USER', 'VTTCC camera service user', TRUE
WHERE NOT EXISTS (SELECT 1 FROM authorities WHERE username='vttcc' AND authority='ROLE_USER');

COMMIT;
