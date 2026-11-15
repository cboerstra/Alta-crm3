import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, X } from "lucide-react";
import { MIN_HOUSING_RADIUS_MILES, RADIUS_OPTIONS, UTAH_AREAS, type TargetArea } from "@shared/metaGeo";

type Props = { areas: TargetArea[]; onChange: (areas: TargetArea[]) => void };

const MAX_AREAS = 3;
const METERS_PER_MILE = 1609.344;
const COLORS = ["#C94F17", "#1F4E9C", "#2E7D4F"];
const PIN = "Dropped pin";

const pinLabel = (lat: number, lng: number) => `${PIN} (${lat.toFixed(3)}, ${lng.toFixed(3)})`;
const isPin = (a: TargetArea) => !UTAH_AREAS.some((u) => u.name === a.name);

/**
 * Where an ad runs: up to three circles, each a town or a dropped pin with a
 * radius of at least 15 miles (Meta's rule for housing ads). Click the map to
 * drop a pin; drag a pin to move it.
 */
export function TargetAreaPicker({ areas, onChange }: Props) {
  const mapEl = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const latest = useRef({ areas, onChange });
  latest.current = { areas, onChange };

  // Create the map once.
  useEffect(() => {
    if (!mapEl.current || map.current) return;
    const m = L.map(mapEl.current, { scrollWheelZoom: false }).setView([41.2, -112.0], 8);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 13,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(m);
    m.on("click", (e: L.LeafletMouseEvent) => {
      const { areas: cur, onChange: change } = latest.current;
      if (cur.length >= MAX_AREAS) return;
      change([...cur, { name: pinLabel(e.latlng.lat, e.latlng.lng), latitude: e.latlng.lat, longitude: e.latlng.lng, radius: 25 }]);
    });
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    // The dialog animates open; measure again once it has its final size.
    setTimeout(() => m.invalidateSize(), 250);
    return () => { m.remove(); map.current = null; };
  }, []);

  // Redraw the circles and pins whenever the areas change.
  useEffect(() => {
    const m = map.current, g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    areas.forEach((a, i) => {
      const color = COLORS[i % COLORS.length];
      L.circle([a.latitude, a.longitude], {
        radius: a.radius * METERS_PER_MILE, color, weight: 2, fillColor: color, fillOpacity: 0.12, interactive: false,
      }).addTo(g);
      const marker = L.marker([a.latitude, a.longitude], {
        draggable: true,
        keyboard: false,
        title: a.name,
        icon: L.divIcon({
          className: "",
          html: `<div style="width:18px;height:18px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        }),
      }).addTo(g);
      marker.on("dragend", () => {
        const p = marker.getLatLng();
        const { areas: cur, onChange: change } = latest.current;
        change(cur.map((x, k) => (k === i ? { ...x, name: pinLabel(p.lat, p.lng), latitude: p.lat, longitude: p.lng } : x)));
      });
    });
  }, [areas]);

  // Frame all the circles when the picker first shows areas.
  const framed = useRef(false);
  useEffect(() => {
    const m = map.current;
    if (!m || framed.current || areas.length === 0) return;
    framed.current = true;
    const bounds = L.latLngBounds([]);
    areas.forEach((a) => bounds.extend(L.latLng(a.latitude, a.longitude).toBounds(a.radius * METERS_PER_MILE * 2)));
    setTimeout(() => { m.invalidateSize(); m.fitBounds(bounds, { padding: [12, 12] }); }, 300);
  }, [areas]);

  const update = (i: number, next: Partial<TargetArea>) =>
    onChange(areas.map((a, k) => (k === i ? { ...a, ...next } : a)));

  const chooseTown = (i: number, name: string) => {
    if (name === PIN) return;
    const town = UTAH_AREAS.find((u) => u.name === name);
    if (town) update(i, { name: town.name, latitude: town.latitude, longitude: town.longitude });
  };

  return (
    <div className="space-y-2">
      <Label>Target areas</Label>
      <div ref={mapEl} className="h-64 w-full rounded-md border overflow-hidden z-0" role="application"
        aria-label="Map of target areas. Click to drop a pin." />
      <p className="text-xs text-muted-foreground">
        {areas.length < MAX_AREAS
          ? "Click the map to drop a pin, or pick a town below. Drag a pin to move it."
          : "Three areas is the most one ad can use. Remove one to drop another pin."}
      </p>
      <div className="space-y-2">
        {areas.map((area, i) => (
          <div key={i} className="grid grid-cols-[14px_minmax(0,1fr)_auto_auto] items-center gap-2">
            <span className="h-3.5 w-3.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} aria-hidden="true" />
            <Select value={isPin(area) ? PIN : area.name} onValueChange={(v) => chooseTown(i, v)}>
              <SelectTrigger aria-label={`Area ${i + 1} center`}>
                <SelectValue>{isPin(area) ? <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{area.name}</span> : `${area.name}, UT`}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {isPin(area) && <SelectItem value={PIN}>{area.name}</SelectItem>}
                {UTAH_AREAS.map((u) => <SelectItem key={u.name} value={u.name}>{u.name}, UT</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={String(area.radius)} onValueChange={(v) => update(i, { radius: Math.max(MIN_HOUSING_RADIUS_MILES, Number(v)) })}>
              <SelectTrigger aria-label={`Area ${i + 1} radius`} className="w-[118px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {RADIUS_OPTIONS.map((r) => <SelectItem key={r} value={String(r)}>{r} miles</SelectItem>)}
              </SelectContent>
            </Select>
            <Button type="button" variant="ghost" size="sm" className="h-9 w-9 p-0" aria-label={`Remove area ${i + 1}`}
              disabled={areas.length === 1} onClick={() => onChange(areas.filter((_, k) => k !== i))}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Housing ads can't target ZIP codes, age or gender, and each area needs a radius of at least 15 miles.
      </p>
    </div>
  );
}
