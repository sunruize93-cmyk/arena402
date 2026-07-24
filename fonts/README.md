# Font self-hosting

Drop the following woff2 files here to eliminate the Google Fonts CDN dependency
entirely.  Currently every `@font-face` rule lists a local path first (fast) and a
Google Fonts URL as fallback (slow, but works everywhere).

## Files needed

| Local filename | Google Fonts CDN fallback URL |
|---|---|
| `instrument-serif-regular.woff2` | `fonts.gstatic.com/s/instrumentserif/v5/jizBRFtNs2ka5fXjeivQ4LroWlx-6zUTjg.woff2` |
| `instrument-serif-italic.woff2` | `fonts.gstatic.com/s/instrumentserif/v5/jizHRFtNs2ka5fXjeivQ4LroWlx-6zAjjH7M.woff2` |
| `ibm-plex-mono-400.woff2` | `fonts.gstatic.com/s/ibmplexmono/v20/-F63fjptAgt5VM-kVkqdyU8n1i8q1w.woff2` |
| `ibm-plex-mono-400italic.woff2` | `fonts.gstatic.com/s/ibmplexmono/v20/-F6pfjptAgt5VM-kVkqdyU8n1ioa1Xdg.woff2` |
| `ibm-plex-mono-500.woff2` | `fonts.gstatic.com/s/ibmplexmono/v20/-F6qfjptAgt5VM-kVkqdyU8n3twJwlBFgg.woff2` |
| `ibm-plex-mono-600.woff2` | `fonts.gstatic.com/s/ibmplexmono/v20/-F6qfjptAgt5VM-kVkqdyU8n3vAOwlBFgg.woff2` |

## Quick download (run from project root with proxy/VPN)

```bash
urls=(
  "https://fonts.gstatic.com/s/instrumentserif/v5/jizBRFtNs2ka5fXjeivQ4LroWlx-6zUTjg.woff2"
  "https://fonts.gstatic.com/s/instrumentserif/v5/jizHRFtNs2ka5fXjeivQ4LroWlx-6zAjjH7M.woff2"
  "https://fonts.gstatic.com/s/ibmplexmono/v20/-F63fjptAgt5VM-kVkqdyU8n1i8q1w.woff2"
  "https://fonts.gstatic.com/s/ibmplexmono/v20/-F6pfjptAgt5VM-kVkqdyU8n1ioa1Xdg.woff2"
  "https://fonts.gstatic.com/s/ibmplexmono/v20/-F6qfjptAgt5VM-kVkqdyU8n3twJwlBFgg.woff2"
  "https://fonts.gstatic.com/s/ibmplexmono/v20/-F6qfjptAgt5VM-kVkqdyU8n3vAOwlBFgg.woff2"
)
names=(
  "instrument-serif-regular.woff2"
  "instrument-serif-italic.woff2"
  "ibm-plex-mono-400.woff2"
  "ibm-plex-mono-400italic.woff2"
  "ibm-plex-mono-500.woff2"
  "ibm-plex-mono-600.woff2"
)
for i in "${!urls[@]}"; do
  curl -sL -o "fonts/${names[$i]}" "${urls[$i]}" && echo "OK ${names[$i]}" || echo "FAIL ${names[$i]}"
done
```

Once all 6 files are here, the site loads fonts from your own Vercel CDN —
zero external dependency, sub-100ms in Asia.
