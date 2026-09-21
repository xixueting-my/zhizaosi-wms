window.WMS_UI = (function () {
  function boot(activeKey) {
    if (window.WMS_SHELL) window.WMS_SHELL.mount(activeKey);
    const user = document.querySelector("[data-current-user]");
    if (user) user.textContent = "Admin";
    const avatar = document.querySelector("[data-avatar]");
    if (avatar) avatar.textContent = "A";
  }

  function show(result) {
    window.WMS.toast(result.message, result.ok ? "ok" : "err");
  }

  function ask(title, def) {
    const v = window.prompt(title, def == null ? "" : String(def));
    if (v == null) return null;
    return v.trim();
  }

  function tag(text, danger) {
    const cls = danger ? "tag tag-red" : "tag tag-gray";
    return `<span class="${cls}">${window.WMS.escapeHtml(text)}</span>`;
  }

  function linkBtn(label, attr, danger) {
    const cls = danger ? "btn-link btn-link-danger" : "btn-link";
    return `<button type="button" class="${cls}" ${attr}>${label}</button>`;
  }

  return { boot, show, ask, tag, linkBtn };
})();
