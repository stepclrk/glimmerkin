/* ===== Keeping a picture on the phone: a journal picture or a little's selfie, as a PNG ===== */
// A web page cannot write to the camera roll itself. On an iPhone or iPad the share sheet can, with Save Image, so
// there the picture goes to the share sheet. Everywhere else it downloads: Android puts it in Downloads, which the
// phone's photos app shows, and a computer puts it in its downloads folder. Everything happens on the device, so it
// works offline, in the home screen app and from a file:// page. The PNG is drawn and encoded at once, inside the tap,
// because Safari only opens the share sheet straight from a tap.
const KEEP_SCALE = 4;   // the picture is drawn at four times the size it has on the sheet: 1200 pixels across
function keepByShare(f) { return IOS && !!(navigator.share && navigator.canShare && navigator.canShare({ files: [f] })); }
function pictureFile(draw, w, h, name) {
  const cv = document.createElement('canvas'); cv.width = w * KEEP_SCALE; cv.height = h * KEEP_SCALE;
  const c = cv.getContext('2d'); c.setTransform(KEEP_SCALE, 0, 0, KEEP_SCALE, 0, 0); draw(c, w, h);
  const bin = atob(cv.toDataURL('image/png').split(',')[1]), u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return new File([u], name, { type: 'image/png' });
}
const keepName = (who, at) => { const d = new Date(at); return 'glimmerkin-' + (String(who).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'picture') + '-' + d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + '.png'; };
function keepPicture(draw, w, h, who, at) {
  let f; try { f = pictureFile(draw, w, h, keepName(who, at)); } catch (e) { toast('The picture could not be made. Try again.'); return; }
  if (keepByShare(f)) {
    navigator.share({ files: [f] }).catch(e => { if (!e || e.name !== 'AbortError') toast('The share sheet did not open. Try again.'); });
    return;
  }
  try {
    const url = URL.createObjectURL(f), a = document.createElement('a'); a.href = url; a.download = f.name; a.style.display = 'none';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
    toast(/Android/i.test(navigator.userAgent) ? 'Saved to Downloads. It shows in your phone\'s photos too.' : 'Saved to your downloads.', 3200);
  } catch (e) { toast('The picture could not be saved. Try again.'); }
}
const KEEP_BTN = '<button class="btn" data-do="keep">' + (IOS ? 'Save to Photos' : 'Save picture') + '</button>';
