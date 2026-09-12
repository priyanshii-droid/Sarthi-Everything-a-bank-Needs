'use strict';

const OFFICIAL_HINTS = /(^|\.)gov(\.in)?$|rbi\.org\.in$|sebi\.gov\.in$|irdai\.gov\.in$|pfrda\.org\.in$|incometax\.gov\.in$|epfindia\.gov\.in$/i;

function classifySource(url = '') {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    if (OFFICIAL_HINTS.test(host)) return 'official';
    if (/bank|nbfc|mutualfund|amfi|nseindia|bseindia/i.test(host)) return 'institutional';
    return 'public';
  } catch { return 'unknown'; }
}

function sourceRecord({url='', title='', publisher='', retrievedAt=new Date().toISOString(), snippet=''}) {
  return { url:String(url||''), title:String(title||''), publisher:String(publisher||''), retrievedAt, type:classifySource(url), snippet:String(snippet||'') };
}

module.exports={classifySource,sourceRecord};
