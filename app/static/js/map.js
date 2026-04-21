/* map.js — Google Maps integration for address autocomplete + preview.
   Loads the Maps JS API on demand; if no key, falls back to a plain address input. */
(function () {
  const apiKey = (window.RM_CONFIG || {}).googleMapsApiKey;

  function loadMapsApi() {
    if (!apiKey) return Promise.reject(new Error("no-key"));
    if (window.google && window.google.maps) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=iw&region=IL`;
      s.async = true; s.defer = true;
      s.onload = resolve; s.onerror = () => reject(new Error("load-failed"));
      document.head.appendChild(s);
    });
  }

  async function attachAutocomplete(inputEl, { onPick } = {}) {
    try {
      await loadMapsApi();
    } catch (e) {
      return {
        manualSubmit: async () => {
          // Fallback — ask the server to geocode via maps_service (which may also fail)
          const addr = inputEl.value.trim();
          if (!addr) return null;
          try {
            const res = await RM.apiFetch("/apartments/api/geocode", { method: "POST", body: { address: addr } });
            if (onPick) onPick(res);
            return res;
          } catch (e) { return { address: addr }; }
        },
      };
    }

    const ac = new google.maps.places.Autocomplete(inputEl, {
      componentRestrictions: { country: "il" },
      fields: ["formatted_address", "geometry", "address_components"],
      types: ["geocode"],
    });
    ac.addListener("place_changed", () => {
      const place = ac.getPlace();
      if (!place.geometry) return;
      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      const comps = {};
      (place.address_components || []).forEach(c => {
        c.types.forEach(t => { comps[t] = c.long_name; });
      });
      const data = {
        formatted_address: place.formatted_address,
        lat, lng,
        city: comps["locality"] || comps["administrative_area_level_2"],
        neighborhood: comps["neighborhood"] || comps["sublocality"],
      };
      if (onPick) onPick(data);
    });
    return { manualSubmit: async () => null };
  }

  function previewMap(containerEl, { lat, lng }) {
    if (!apiKey || !containerEl) return;
    loadMapsApi().then(() => {
      const map = new google.maps.Map(containerEl, {
        center: { lat, lng }, zoom: 15, disableDefaultUI: true, gestureHandling: "cooperative",
      });
      new google.maps.Marker({ position: { lat, lng }, map });
    }).catch(() => {
      containerEl.innerHTML = '<div class="small" style="padding:8px;">מפה לא זמינה — מפתח Google Maps חסר</div>';
    });
  }

  window.RM.MAP = { attachAutocomplete, previewMap };
})();
