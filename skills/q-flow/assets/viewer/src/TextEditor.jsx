import React, { useEffect, useRef, useState } from 'react';
import { translate } from './i18n.js';

export function useTextEditor(node, edge, onSaveNode, onSaveEdge, locale) {
  const object = edge ?? node, key = object ? `${edge ? 'edge' : 'node'}:${object.id}` : null;
  const [draft, setDraft] = useState({ editing: false, label: '', subtitle: '', error: '' });
  const reset = (returnFocus = false) => setDraft({ editing: false, label: object?.label ?? '', subtitle: node?.subtitle ?? '', error: '', returnFocus });
  useEffect(() => reset(), [key]);
  const set = patch => setDraft(current => ({ ...current, ...patch }));
  return { ...draft, set, cancel: () => reset(true), begin: () => set({ editing: true, returnFocus: false }), save: event => {
    event.preventDefault();
    const label = draft.label.trim();
    if (!label) { set({ error: translate(locale, 'Name is required') }); return; }
    if (edge) onSaveEdge(edge.id, label); else onSaveNode(node.id, label, draft.subtitle.trim());
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
    {!relation && <label>{t('Description')}<textarea value={editor.subtitle} onChange={event => editor.set({ subtitle: event.target.value, error: '' })} /></label>}
    {editor.error && <p className="card-error" role="alert">{editor.error}</p>}
    <div className="card-actions"><button type="button" onClick={editor.cancel}>{t('Cancel')}</button><button type="submit">{t('Save')}</button></div>
  </form> : <button ref={button} disabled={locked} title={locked ? t('Unlock the layout first') : ''} onClick={editor.begin}>{t('Edit text')}</button>;
}
