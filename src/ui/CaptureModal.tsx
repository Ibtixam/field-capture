import * as Crypto from 'expo-crypto';
import { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { persistPhoto, takePhoto } from '../media/photos';
import { syncEngine } from '../sync/SyncEngine';
import { CATEGORIES, type Category } from '../types';
import { colors } from './theme';

export function CaptureModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState<Category>('Inspection');
  const [photo, setPhoto] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setTitle('');
    setNotes('');
    setCategory('Inspection');
    setPhoto(null);
  };

  const save = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      const id = Crypto.randomUUID();
      const now = Date.now();
      const photoUri = photo ? await persistPhoto(photo, id) : null;
      await syncEngine.capture({
        id,
        title: title.trim(),
        notes: notes.trim(),
        category,
        photoUri,
        createdAt: now,
        updatedAt: now,
        status: 'pending',
        attempts: 0,
        nextAttemptAt: 0,
        lastError: null,
        syncedAt: null,
        remoteId: null,
      });
      reset();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
          <Text style={styles.heading}>New capture</Text>
          <Pressable onPress={save} disabled={!title.trim() || saving} hitSlop={10}>
            <Text style={[styles.save, (!title.trim() || saving) && styles.disabled]}>Save</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Cracked tile, Level 2 bathroom"
            placeholderTextColor={colors.muted}
            autoFocus
          />
          <Text style={styles.label}>Category</Text>
          <View style={styles.chips}>
            {CATEGORIES.map((c) => (
              <Pressable key={c} onPress={() => setCategory(c)} style={[styles.chip, c === category && styles.chipOn]}>
                <Text style={[styles.chipText, c === category && styles.chipTextOn]}>{c}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>Notes</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={notes}
            onChangeText={setNotes}
            placeholder="What did you see?"
            placeholderTextColor={colors.muted}
            multiline
          />
          <Text style={styles.label}>Photo</Text>
          {photo ? (
            <Pressable onPress={() => setPhoto(null)}>
              <Image source={{ uri: photo }} style={styles.photo} />
              <Text style={styles.hint}>Tap to remove</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.photoBtn} onPress={async () => setPhoto(await takePhoto())}>
              <Text style={styles.photoBtnText}>Take photo</Text>
            </Pressable>
          )}
          <Text style={styles.hint}>Saved to this device first. Works with no signal.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.card,
  },
  heading: { fontSize: 17, fontWeight: '700', color: colors.ink },
  cancel: { fontSize: 16, color: colors.muted },
  save: { fontSize: 16, fontWeight: '700', color: colors.accent },
  disabled: { opacity: 0.35 },
  form: { padding: 16, gap: 8 },
  label: { fontSize: 13, fontWeight: '600', color: colors.muted, marginTop: 8 },
  input: {
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: colors.ink,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { color: colors.ink, fontWeight: '500' },
  chipTextOn: { color: '#fff' },
  photoBtn: { borderRadius: 10, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.muted, padding: 20, alignItems: 'center' },
  photoBtnText: { fontWeight: '600', color: colors.ink },
  photo: { width: '100%', height: 200, borderRadius: 10 },
  hint: { fontSize: 12, color: colors.muted, marginTop: 6 },
});
