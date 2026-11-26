import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Sheet } from '@/components/Sheet';
import { TextField } from '@/components/TextField';
import { addNote, notesByCountryQuery, removeNote, restoreNote, updateNote, type Note } from '@/db';
import { dbContext, expoDb } from '@/db/client';
import { formatDay } from '@/lib/dates';
import { showUndo } from '@/lib/undo';
import { spacing } from '@/theme';

import { ListRow } from './ListRow';
import { Section } from './Section';

type Editing = Note | 'new' | null;

export function NotesSection({ iso2 }: { iso2: string }) {
  const { t } = useTranslation();
  const months = t('months.short', { returnObjects: true });
  const { data: notes } = useLiveQuery(notesByCountryQuery(expoDb, iso2), [iso2]);
  const [editing, setEditing] = useState<Editing>(null);

  return (
    <Section
      title={t('notes.title')}
      actionLabel={t('common.add')}
      onAction={() => setEditing('new')}>
      {notes.length === 0 ? <AppText variant="muted">{t('notes.empty')}</AppText> : null}
      <View style={styles.list}>
        {notes.map((n) => (
          <ListRow
            key={n.id}
            title={n.text}
            titleLines={3}
            subtitle={formatDay(n.updatedAt.slice(0, 10), months)}
            onPress={() => setEditing(n)}
            accessibilityHint={t('common.editHint')}
          />
        ))}
      </View>
      {editing ? (
        <NoteSheet
          iso2={iso2}
          note={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </Section>
  );
}

function NoteSheet({
  iso2,
  note,
  onClose,
}: {
  iso2: string;
  note: Note | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState(note?.text ?? '');
  const empty = !text.trim();

  const save = async () => {
    if (note) await updateNote(dbContext, note.id, text);
    else await addNote(dbContext, { countryIso: iso2, text });
    onClose();
  };

  const remove = async () => {
    if (!note) return;
    await removeNote(dbContext, note.id);
    onClose();
    showUndo({ message: t('undo.noteDeleted'), undo: () => restoreNote(dbContext, note.id) });
  };

  return (
    <Sheet
      visible
      title={note ? t('notes.edit') : t('notes.new')}
      onClose={onClose}
      footer={
        <>
          <Button
            variant="primary"
            label={t('common.save')}
            onPress={() => void save()}
            disabled={empty}
          />
          {note ? (
            <Button variant="danger" label={t('common.delete')} onPress={() => void remove()} />
          ) : null}
        </>
      }>
      <TextField
        value={text}
        onChangeText={setText}
        multiline
        autoFocus={!note}
        placeholder={t('notes.placeholder')}
        accessibilityLabel={t('notes.title')}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.xs,
  },
});
