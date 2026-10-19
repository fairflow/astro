# Astrodynamics: privacy notice (DRAFT for Matthew's decision)

Status: draft, 2026-10-19, astro-tbb.1. Not legal advice. Items marked
**[DECIDE]** need Matthew's choice before publication. Once agreed, this is
published as a page in the app, linked from the registration form and from
Settings → Account, and nothing stored on the server is deployed before it.

---

## Who we are

Astrodynamics (fairflow.co.uk/astro) is run by **[DECIDE: "Matthew Fairtlough"
or "Fairflow"]**, who decides how your data is used (the "controller" under UK
data protection law). Contact: **[DECIDE: an address for privacy questions,
e.g. privacy@fairflow.co.uk]**.

## Using the app without an account

Charts, settings and Ask Claude readings are kept **in your own browser**
(its local storage) and are not sent to us. They stay on that device until you
clear them.

When you choose **Ask Claude**, the chart factors shown in the panel's preview
(names and places hidden unless you untick that) are sent through our relay to
Anthropic, whose model writes the reading. Anthropic's handling is covered by
its own terms; we do not keep a copy on our server. (Checked 2026-10-19: the relay's
code logs nothing and no Cloudflare log capture is configured; Cloudflare keeps
only request counts.)

## If you have an account

We store, on our own server in the UK **[DECIDE: confirm the host's data
centre location]**:

- **Your email address** and a **hash** of your password (never the password
  itself).
- **Sign-in records:** session records so you stay signed in (a random token,
  stored only as a hash, with when it was last used), and short-lived records
  of failed sign-in attempts to stop password guessing.
- **Your account's state** (waiting for approval, active, paused, frozen or
  scheduled for deletion) and role.
- **When we add these features:** your saved charts and Ask Claude readings,
  so they are available on all your devices, and the email codes we send you to
  confirm your address and to sign in.

**About other people's data.** Saved charts can include birth details of other
people (a partner, a friend), and readings can mention them by name. Please add
someone else's details only if they would be happy for you to; you can delete
any chart or reading at any time.

## Why we use it (lawful basis)

To provide the account you asked for (contract), and to keep the service secure
and working (legitimate interests). We do not use your data for advertising,
do not sell it, and do not share it except with the services that run the site
(the web host, and Anthropic for Ask Claude readings you request).

## How long we keep it

| What | Kept for |
|---|---|
| Account, charts, readings | Until you delete them or close your account |
| After you ask to close your account | 30 days (so you can change your mind), then deleted permanently |
| Sessions | Ended when you sign out, or after 90 days unused |
| Failed sign-in records | 1 day |
| Email sign-in codes | 10 minutes; used codes are not kept **[DECIDE]** |
| Server backups | Up to **[DECIDE: the host's backup period]**, then overwritten |

## Your rights

You can **download** everything stored for your account, **correct** it,
**delete** individual charts and readings, and **close your account**
(deleted after 30 days, and you can cancel within that time). You can also ask
us what we hold, object to how we use it, or complain to the Information
Commissioner's Office (ico.org.uk).

## Cookies

One cookie, needed to keep you signed in. It is set only when you sign in,
is sent only to the app's own server, and cannot be read by scripts on the
page. No analytics, advertising or tracking cookies.

## Changes

If this notice changes in a way that matters, we will say so in the app.
Last updated: **[date of publication]**.

---

### Notes for Matthew (not part of the notice)

1. **ICO data protection fee.** Anyone controlling personal data in the UK may
   owe the ICO an annual fee unless exempt; a non-commercial hobby service may
   be. Worth a two-minute check with the ICO's online self-assessment before
   registration opens.
2. **Under-age users:** say nothing, or state a minimum age (13 is the UK
   threshold for online services). **[DECIDE]**
3. The 30-day grace period, 90-day sessions and one-day failure records match
   what the code does (DESIGN.md §5a).
