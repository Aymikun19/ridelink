import L from "leaflet";

function pin(color: string, inner: string) {
  return L.divIcon({
    className: "rl-marker",
    iconSize: [36, 44],
    iconAnchor: [18, 42],
    html: `<svg width="36" height="44" viewBox="0 0 36 44" xmlns="http://www.w3.org/2000/svg">
      <path d="M18 43s15-13.3 15-25A15 15 0 0 0 3 18c0 11.7 15 25 15 25z" fill="${color}" stroke="#0b0b0b" stroke-width="2"/>
      ${inner}
    </svg>`,
  });
}

export const pickupIcon = pin("#ffffff", `<circle cx="18" cy="18" r="6" fill="#0b0b0b"/>`);
export const dropoffIcon = pin("#c9a84c", `<rect x="12" y="12" width="12" height="12" rx="2" fill="#0b0b0b"/>`);

export function carIcon(heading?: number | null) {
  const rotate = heading != null && !Number.isNaN(heading) ? heading : 0;
  return L.divIcon({
    className: "rl-marker",
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    html: `<div style="position:relative;width:44px;height:44px">
      <span class="rl-pulse" style="position:absolute;inset:6px;border-radius:999px;background:rgba(201,168,76,.45)"></span>
      <svg width="44" height="44" viewBox="0 0 44 44" style="position:absolute;inset:0;transform:rotate(${rotate}deg)" xmlns="http://www.w3.org/2000/svg">
        <circle cx="22" cy="22" r="15" fill="#0b0b0b" stroke="#c9a84c" stroke-width="2.5"/>
        <path d="M22 12l7 16-7-4-7 4z" fill="#c9a84c"/>
      </svg>
    </div>`,
  });
}

export const meIcon = L.divIcon({
  className: "rl-marker",
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  html: `<div style="position:relative;width:24px;height:24px">
    <span class="rl-pulse" style="position:absolute;inset:0;border-radius:999px;background:rgba(90,169,255,.5)"></span>
    <span style="position:absolute;inset:5px;border-radius:999px;background:#5aa9ff;border:2px solid #fff"></span>
  </div>`,
});
