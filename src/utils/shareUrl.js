const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function extractIPv4FromCandidate(candidateText) {
  const match = candidateText.match(
    /(?:\b(?:\d{1,3}\.){3}\d{1,3}\b)/
  );
  if (!match) return null;
  const ip = match[0];
  if (ip.startsWith("127.")) return null;
  const parts = ip.split(".").map((n) => Number(n));
  if (parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return null;
  return ip;
}

function isPrivateLanIPv4(ip) {
  const parts = ip.split(".").map((n) => Number(n));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return false;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function isLinkLocalIPv4(ip) {
  const parts = ip.split(".").map((n) => Number(n));
  return parts[0] === 169 && parts[1] === 254;
}

function pickBestLanIp(ips) {
  if (!ips.length) return null;
  const privateIp = ips.find((ip) => isPrivateLanIPv4(ip));
  if (privateIp) return privateIp;
  const nonLinkLocal = ips.find((ip) => !isLinkLocalIPv4(ip));
  return nonLinkLocal || ips[0];
}

async function detectLanIPv4(timeoutMs = 1200) {
  if (!window.RTCPeerConnection) return null;

  return new Promise((resolve) => {
    const pc = new window.RTCPeerConnection({ iceServers: [] });
    let resolved = false;
    const candidates = new Set();

    const finish = (ip) => {
      if (resolved) return;
      resolved = true;
      try {
        pc.close();
      } catch (_) {}
      resolve(ip);
    };

    const timer = window.setTimeout(() => {
      finish(pickBestLanIp([...candidates]));
    }, timeoutMs);

    pc.onicecandidate = (event) => {
      const candidate = event?.candidate?.candidate;
      if (!candidate) {
        window.clearTimeout(timer);
        finish(pickBestLanIp([...candidates]));
        return;
      }
      const ip = extractIPv4FromCandidate(candidate);
      if (ip) candidates.add(ip);
    };

    pc.createDataChannel("share-link");
    pc.createOffer()
      .then((offer) => pc.setLocalDescription(offer))
      .catch(() => {
        window.clearTimeout(timer);
        finish(null);
      });
  });
}

export async function getShareOrigin() {
  const { protocol, hostname, port, origin } = window.location;
  if (!LOCAL_HOSTS.has(hostname)) return origin;

  const lanIp = await detectLanIPv4();
  if (!lanIp) return origin;

  return `${protocol}//${lanIp}${port ? `:${port}` : ""}`;
}
