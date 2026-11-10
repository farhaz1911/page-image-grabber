// Opens the grabber in the same kind of window (normal or private) as the page.
chrome.action.onClicked.addListener(async (tab) => {
  const url = chrome.runtime.getURL("app.html") + "?tabId=" + tab.id;

  // 1) Try a new tab right next to the current one, in the same window.
  try {
    const t = await chrome.tabs.create({
      url,
      windowId: tab.windowId,
      index: tab.index + 1,
      openerTabId: tab.id
    });
    if (t.incognito === tab.incognito) return; // opened in the right mode
    await chrome.tabs.remove(t.id);            // wrong mode (browser quirk): undo
  } catch (e) { /* fall through */ }

  // 2) Fallback: open a new window explicitly in the same mode.
  chrome.windows.create({
    url,
    incognito: tab.incognito,
    type: "normal",
    width: 860,
    height: 720
  });
});
