import React, { useEffect, useRef, useState } from 'react';
import { evidenceLabels } from './visual-style.js';
import { translate } from './i18n.js';

export function useTextEditor(node, edge, onSaveNode, onSaveEdge, locale, onCancel = () => {}) {
  const object = edge ?? node, key = object ? `${edge ? 'edge' : 'node'}:${object.id}` : null;
  const saveToken = useRef(0);
  const [draft, setDraft] = useState({ editing: false, pending: false, label: '', subtitle: '', error: '' });
  const reset = (returnFocus = false) => setDraft({ editing: false, pending: false, label: object?.label ?? '', subtitle: node?.subtitle ?? '', error: '', returnFocus });
  useEffect(() => { saveToken.current++; onCancel(); reset(); }, [key]);
  const set = patch => setDraft(current => ({ ...current, ...patch }));
  return { ...draft, set, cancel: () => { saveToken.current++; onCancel(); reset(true); }, begin: () => set({ editing: true, returnFocus: false, label: object?.label ?? '', subtitle: node?.subtitle ?? '', error: '' }), save: async event => {
    event.preventDefault();
    if (draft.pending) return;
    const label = draft.label.trim();
    if (!label) { set({ error: translate(locale, 'Name is required') }); return; }
    const token = ++saveToken.current; set({ pending: true });
    const error = await (edge ? onSaveEdge(edge.id, label) : onSaveNode(node.id, label, draft.subtitle.trim()));
    if (saveToken.current !== token) return;
    set({ pending: false });
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
  return editor.editing ? <form aria-busy={editor.pending} className="card-form" onSubmit={editor.save} onKeyDown={event => {
    if (event.nativeEvent.isComposing || event.keyCode === 229) { if (event.key === 'Enter') event.preventDefault(); return; }
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); editor.cancel(); }
  }}>
    <label>{t('Name')}<input ref={input} autoFocus required disabled={editor.pending} value={editor.label} onChange={event => editor.set({ label: event.target.value, error: '' })} aria-invalid={Boolean(editor.error)} /></label>
    {!relation && <label>{t('Description')}<textarea disabled={editor.pending} value={editor.subtitle} onChange={event => editor.set({ subtitle: event.target.value, error: '' })} /></label>}
    {editor.error && <p className="card-error" role="alert">{editor.error}</p>}
    <div className="card-actions"><button type="button" onClick={editor.cancel}>{t('Cancel')}</button><button type="submit" disabled={editor.pending}>{t('Save')}</button></div>
  </form> : <button ref={button} disabled={locked} title={locked ? t('Unlock the layout first') : ''} onClick={editor.begin}>{t('Edit text')}</button>;
}
