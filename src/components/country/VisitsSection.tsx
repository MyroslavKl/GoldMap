import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { DateField } from '@/components/DateField';
import { Sheet } from '@/components/Sheet';
import {
  addVisit,
  removeVisit,
  restoreVisit,
  updateVisitDates,
  visitsByCountryQuery,
  type Visit,
} from '@/db';
import { dbContext, expoDb } from '@/db/client';
import { formatPeriod, periodDays } from '@/lib/dates';
import { hapticMarked } from '@/lib/haptics';
import { showUndo } from '@/lib/undo';
import { spacing } from '@/theme';

import { ListRow } from './ListRow';
import { Section } from './Section';

/** Редагований візит: null — закрито, 'new' — новий. */
type Editing = Visit | 'new' | null;

export function VisitsSection({ iso2 }: { iso2: string }) {
  const { t } = useTranslation();
  const months = t('months.short', { returnObjects: true });
  const { data: visits } = useLiveQuery(visitsByCountryQuery(expoDb, iso2), [iso2]);
  const [editing, setEditing] = useState<Editing>(null);

  return (
    <Section
      title={t('visits.title')}
      actionLabel={t('common.add')}
      onAction={() => setEditing('new')}>
      {visits.length === 0 ? <AppText variant="muted">{t('visits.empty')}</AppText> : null}
      <View style={styles.list}>
        {visits.map((v) => {
          const period = formatPeriod(v.startDate, v.endDate, months);
          const days =
            v.startDate && v.endDate
              ? t('visits.days', { count: periodDays(v.startDate, v.endDate) })
              : null;
          return (
            <ListRow
              key={v.id}
              title={period ?? t('visits.noDates')}
              subtitle={period ? days : t('visits.addDatesHint')}
              onPress={() => setEditing(v)}
              accessibilityHint={t('common.editHint')}
            />
          );
        })}
      </View>
      {editing ? (
        <VisitSheet
          iso2={iso2}
          visit={editing === 'new' ? null : editing}
          wasVisited={visits.length > 0}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </Section>
  );
}

type SheetProps = {
  iso2: string;
  visit: Visit | null;
  wasVisited: boolean;
  onClose: () => void;
};

function VisitSheet({ iso2, visit, wasVisited, onClose }: SheetProps) {
  const { t } = useTranslation();
  const [start, setStart] = useState<string | null>(visit?.startDate ?? null);
  const [end, setEnd] = useState<string | null>(visit?.endDate ?? null);
  const invalid = !!start && !!end && start > end;

  const save = async () => {
    if (visit) await updateVisitDates(dbContext, visit.id, { startDate: start, endDate: end });
    else {
      await addVisit(dbContext, { countryIso: iso2, startDate: start, endDate: end });
      if (!wasVisited) hapticMarked();
    }
    onClose();
  };

  const remove = async () => {
    if (!visit) return;
    await removeVisit(dbContext, visit.id);
    onClose();
    showUndo({ message: t('undo.visitDeleted'), undo: () => restoreVisit(dbContext, visit.id) });
  };

  return (
    <Sheet
      visible
      title={visit ? t('visits.edit') : t('visits.new')}
      onClose={onClose}
      footer={
        <>
          <Button
            variant="primary"
            label={t('common.save')}
            onPress={() => void save()}
            disabled={invalid}
          />
          {visit ? (
            <Button variant="danger" label={t('common.delete')} onPress={() => void remove()} />
          ) : null}
        </>
      }>
      <DateField
        label={t('visits.from')}
        value={start}
        onChange={setStart}
        optional
        maximumDate={end}
      />
      <DateField
        label={t('visits.to')}
        value={end}
        onChange={setEnd}
        optional
        minimumDate={start}
      />
      <AppText variant="muted">{t('visits.datesOptional')}</AppText>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.xs,
  },
});
