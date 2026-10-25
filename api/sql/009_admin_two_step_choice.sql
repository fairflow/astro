-- Admins choose two-step sign-in too (Matthew, 2026-10-25). Until now an admin
-- always had it, whatever users.two_step said; from here users.two_step alone
-- decides. Today's admins start with it on, so nothing gets weaker by itself;
-- making someone an admin turns it on (set_role); an admin may then turn it off.
UPDATE users SET two_step = 1 WHERE role = 'admin';
