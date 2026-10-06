import React, { useEffect, useRef, useState } from 'react';
import { evidenceLabels } from './visual-style.js';
import { translate } from './i18n.js';

export function useTextEditor(node, edge, onSaveNode, onSaveEdge, locale, overviewView = false) {
  const object = edge ?? node, key = object ? `${edge ? 'edge' : 'node'}:${object.id}` : null;
  const overview = Boolean(node && (overviewView || node.section || node.overviewText !== undefined || node.badges !== undefined));
  const [draft, setDraft] = useState({ editing: false, label: '', subtitle: '', overviewText: '', badges: [], error: '' });
  const reset = (returnFocus = false) => setDraft({ editing: false, label: object?.label ?? '', subtitle: node?.subtitle ?? '', overviewText: (node?.overviewText ?? []).join('\n'), badges: structuredClone(node?.badges ?? []), error: '', returnFocus });
  useEffect(() => reset(), [key]);
  const set = patch => setDraft(current => ({ ...current, ...patch }));
  return { ...draft, section: Boolean(node?.section), overview, set, cancel: () => reset(true), begin: () => set({ editing: true, returnFocus: false, label: object?.label ?? '', subtitle: node?.subtitle ?? '', overviewText: (node?.overviewText ?? []).join('\n'), badges: structuredClone(node?.badges ?? []), error: '' }), save: event => {
    event.preventDefault();
    const label = draft.label.trim();
    if (!label) { set({ error: translate(locale, 'Name is required') }); return; }
    if (draft.badges.some(badge => !badge.label.trim())) { set({ error: translate(locale, 'Name is required') }); return; }
    const error = edge ? onSaveEdge(edge.id, label) : onSaveNode(node.id, label, draft.subtitle.trim(), overview ? { overviewText: draft.overviewText.split(/\r?\n/).map(line => line.trim()).filter(Boolean), ...(node.section ? {} : { badges: draft.badges }) } : {});
    if (error) { set({ error }); return; }
    set({ editing: false, error: '' });
  } };
}

export default function TextEditor({ editor, relation, locked, locale }) {
  const t = message => translate(locale, message), button = useRef(null), input = useRef(null);
  useEffect(() => {
    if (!editor.editing && editor.returnFocus) button.current?.focus();
    if (editor.error) input.current?.focus();
  }, [editor.editing, editor.error, editor.returnFocus]);
  return editor.editing ? <form className="card-form" onSubmit={editor.save} onKeyDown={event => {
    if (event.nativeEvent.isComposing || event.keyCode === 229) { if (event.key === 'Enter') event.preventDefault(); return; }
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); editor.cancel(); }
  }}>
    <label>{t('Name')}<input ref={input} autoFocus required value={editor.label} onChange={event => editor.set({ label: event.target.value, error: '' })} aria-invalid={Boolean(editor.error)} /></label>
    {!relation && !editor.section && <label>{t('Description')}<textarea value={editor.subtitle} onChange={event => editor.set({ subtitle: event.target.value, error: '' })} /></label>}
    {!relation && editor.overview && <label>{t('Overview text')}<textarea aria-label={t('Overview text')} value={editor.overviewText} onChange={event => editor.set({ overviewText: event.target.value, error: '' })} /></label>}
    {!relation && editor.overview && !editor.section && <fieldset><legend>{t('Badges')}</legend>{editor.badges.map((badge, index) => { const update = patch => editor.set({ badges: editor.badges.map((item, i) => i === index ? { ...item, ...patch } : item) }); return <div className="badge-editor" key={index}><label>{t('Name')}<input aria-label={`${t('Badges')} ${index + 1}`} value={badge.label} onChange={event => { const { source, ...rest } = badge; update({ ...rest, source: undefined, label: event.target.value, evidence: 'document' }); }} /></label><label>{t('Badge type')}<select value={badge.role} onChange={event => update({ role: event.target.value })}>{['status', 'version', 'requirement'].map(role => <option key={role} value={role}>{t({ status: 'Status', version: 'Version', requirement: 'Requirement' }[role])}</option>)}</select></label><label>{t('Evidence')}<select value={badge.evidence} onChange={event => update({ evidence: event.target.value })}>{['source', 'code', 'config', 'schema', 'test', 'document', 'framework', 'inference'].map(kind => <option key={kind} value={kind}>{t(evidenceLabels[kind] ?? kind)}</option>)}</select></label><button type="button" onClick={() => editor.set({ badges: editor.badges.filter((_, i) => i !== index) })}>{t('Remove badge')}</button></div>; })}<button type="button" onClick={() => editor.set({ badges: [...editor.badges, { label: '', role: 'status', evidence: 'document' }] })}>{t('Add badge')}</button></fieldset>}
    {editor.error && <p className="card-error" role="alert">{editor.error}</p>}
    <div className="card-actions"><button type="button" onClick={editor.cancel}>{t('Cancel')}</button><button type="submit">{t('Save')}</button></div>
  </form> : <button ref={button} disabled={locked} title={locked ? t('Unlock the layout first') : ''} onClick={editor.begin}>{t('Edit text')}</button>;
}
