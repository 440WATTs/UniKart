#!/usr/bin/env python3
"""Build public/landing.html from landing/source-index.html.

The landing page source is landing/source-index.html: the original page from the
UniKart repository, with the product name changed from UniMart to UniKart.
This script makes the minimum changes needed to connect it to the marketplace:

  * removes the demo login dialog (it "logged in" anyone via localStorage)
  * replaces the navigation script so Shop / Sell / Categories / Login go to
    real routes and the account button reflects the real Supabase session
  * wires the hero icons, category tiles and the sample card CTA to routes
  * extracts the brand logo to public/brand/unikart-logo.png for the app

Run: python3 scripts/build-landing.py
"""
import base64
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "landing" / "source-index.html"
OUT = ROOT / "public" / "landing.html"
LOGO = ROOT / "public" / "brand" / "unikart-logo.png"

html = SRC.read_text(encoding="utf-8")

# 1. Extract the brand logo (first image inside the .brand link).
m = re.search(r'<a class="brand"[^>]*>\s*<img\s+src="data:image/png;base64,([A-Za-z0-9+/=]+)"', html)
if not m:
    raise SystemExit("brand logo not found")
LOGO.parent.mkdir(parents=True, exist_ok=True)
LOGO.write_bytes(base64.b64decode(m.group(1)))

# 2. Remove the fake login dialog markup.
html, n = re.subn(r'\s*<div class="ov" id="ov" hidden>.*?</form>\s*</div>\s*</div>', "", html, count=1, flags=re.S)
if n != 1:
    raise SystemExit("login overlay not found")

# 3. Replace the navigation script (the one that defines SHOP_URL).
scripts = list(re.finditer(r"<script>(.*?)</script>", html, flags=re.S))
nav = next((s for s in scripts if "SHOP_URL" in s.group(1)), None)
if not nav:
    raise SystemExit("navigation script not found")

NAV_JS = r"""
      (function () {
        var $ = function (i) {
            return document.getElementById(i);
          },
          B = matchMedia("(prefers-reduced-motion:reduce)").matches
            ? "auto"
            : "smooth",
          user = null;
        // Landing-page category labels -> marketplace category + search term
        var CAT = {
          Textbooks: "category=books",
          Books: "category=books",
          Laptops: "category=electronics&q=laptop",
          Electronics: "category=electronics",
          Headphones: "category=electronics&q=headphones",
          Bicycles: "category=cycles",
          "Hostel Furniture": "category=hostel",
          Hostel: "category=hostel",
          Calculators: "category=study&q=calculator",
        };
        var acct = $("acct"),
          um = $("um"),
          dd = $("dd"),
          lk = $("links"),
          cb = $("catBtn");
        function go(u) {
          location.href = u;
        }
        function shop(c) {
          go(c && CAT[c] ? "/search?" + CAT[c] : "/marketplace");
        }
        function render() {
          acct.textContent = user ? "\u{1F464} " + user.name : "Login";
          acct.setAttribute("aria-haspopup", user ? "true" : "false");
        }
        function closeAll() {
          dd.classList.remove("open");
          um.classList.remove("open");
          cb.setAttribute("aria-expanded", "false");
        }
        // Account menu: real links once signed in.
        um.innerHTML =
          '<a href="/account" role="menuitem">My account</a>' +
          '<a href="/messages" role="menuitem">Messages</a>' +
          '<a href="#" role="menuitem" data-go="logout">Log out</a>';
        fetch("/api/session", { credentials: "same-origin" })
          .then(function (r) {
            return r.ok ? r.json() : null;
          })
          .then(function (d) {
            user = d && d.user ? d.user : null;
            render();
          })
          .catch(function () {});
        render();
        document.addEventListener("click", function (e) {
          var a = e.target.closest("[data-go]");
          if (a) {
            e.preventDefault();
            var g = a.dataset.go;
            closeAll();
            lk.classList.remove("open");
            $("burger").setAttribute("aria-expanded", "false");
            if (g === "home") scrollTo({ top: 0, behavior: B });
            else if (g === "about")
              scrollTo({
                top: document.documentElement.scrollHeight,
                behavior: B,
              });
            else if (g === "shop") shop(a.dataset.cat);
            else if (g === "sell") go("/sell");
            else if (g === "logout") {
              fetch("/auth/signout", { method: "POST" }).then(function () {
                user = null;
                render();
                go("/");
              });
            }
            return;
          }
          if (!e.target.closest(".cw2,.acct")) closeAll();
        });
        cb.addEventListener("click", function () {
          um.classList.remove("open");
          var o = dd.classList.toggle("open");
          cb.setAttribute("aria-expanded", o);
        });
        acct.addEventListener("click", function () {
          dd.classList.remove("open");
          if (!user) go("/login");
          else um.classList.toggle("open");
        });
        $("burger").addEventListener("click", function () {
          var o = lk.classList.toggle("open");
          this.setAttribute("aria-expanded", o);
        });
        addEventListener("keydown", function (e) {
          if (e.key === "Escape") closeAll();
        });
        // Hero desktop icons, category tiles and the sample card CTA.
        var ICON = {
          Buy: "/marketplace",
          Sell: "/sell",
          Search: "/search",
          Messages: "/messages",
          Profile: "/account",
          Sold: "/account/listings?tab=sold",
        };
        function link(el, href) {
          if (!href) return;
          el.setAttribute("href", href);
          el.style.cursor = "pointer";
        }
        document.querySelectorAll("a.ic").forEach(function (a) {
          var t = (a.textContent || "").trim();
          link(a, ICON[t] || (CAT[t] ? "/search?" + CAT[t] : null));
        });
        document.querySelectorAll(".cat").forEach(function (c) {
          var t = (c.textContent || "").trim();
          if (!CAT[t]) return;
          c.setAttribute("role", "link");
          c.setAttribute("tabindex", "0");
          c.style.cursor = "pointer";
          c.addEventListener("click", function () {
            shop(t);
          });
          c.addEventListener("keydown", function (e) {
            if (e.key === "Enter") shop(t);
          });
        });
        document.querySelectorAll(".p-btn").forEach(function (b) {
          link(b, "/marketplace");
        });
      })();
    """

html = html[: nav.start(1)] + NAV_JS + html[nav.end(1):]
OUT.write_text(html, encoding="utf-8")

# 4. Content-Security-Policy hashes for the page's inline scripts (read by next.config.ts).
import hashlib
import json

hashes = [
    "'sha256-" + base64.b64encode(hashlib.sha256(m.group(1).encode("utf-8")).digest()).decode() + "'"
    for m in re.finditer(r"<script>(.*?)</script>", html, flags=re.S)
]
(ROOT / "landing" / "csp.json").write_text(json.dumps({"scriptHashes": hashes}, indent=2) + "\n", encoding="utf-8")
print(f"wrote {OUT.relative_to(ROOT)} ({len(html)} bytes), {LOGO.relative_to(ROOT)} and landing/csp.json ({len(hashes)} script hashes)")
