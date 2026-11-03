import { Ionicons } from '@react-native-vector-icons/ionicons';
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
import { categoryStyle, colors, shadow } from './theme';

export function CaptureModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState<Category>('Inspection');
  const [photo, setPhoto] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const canSave = !!title.trim() && !saving;

  const reset = () => {
    setTitle('');
    setNotes('');
    setCategory('Inspection');
    setPhoto(null);
  };

  const save = async () => {
    if (!canSave) return;
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
          <Pressable onPress={onClose} hitSlop={10} style={styles.iconBtn} accessibilityLabel="Close">
            <Ionicons name="close" size={20} color={colors.ink} />
          </Pressable>
          <Text style={styles.heading}>New capture</Text>
          <Pressable
            onPress={save}
            disabled={!canSave}
            hitSlop={10}
            style={[styles.saveBtn, !canSave && styles.saveBtnOff]}
            accessibilityRole="button"
          >
            <Text style={[styles.saveText, !canSave && styles.saveTextOff]}>{saving ? 'Saving…' : 'Save'}</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Title</Text>
          <TextInput
            style={[styles.input, styles.titleInput]}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Cracked tile, Level 2 bathroom"
            placeholderTextColor={colors.faint}
            autoFocus
          />

          <Text style={styles.label}>Category</Text>
          <View style={styles.grid}>
            {CATEGORIES.map((c) => {
              const cs = categoryStyle[c];
              const on = c === category;
              return (
                <Pressable
                  key={c}
                  onPress={() => setCategory(c)}
                  style={[styles.tile, on && { borderColor: cs.fg, backgroundColor: cs.bg }]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                >
                  <View style={[styles.tileIcon, { backgroundColor: on ? colors.card : cs.bg }]}>
                    <Ionicons name={cs.icon} size={18} color={cs.fg} />
                  </View>
                  <Text style={[styles.tileText, on && { color: cs.fg }]}>{c}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>Notes</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={notes}
            onChangeText={setNotes}
            placeholder="What did you see?"
            placeholderTextColor={colors.faint}
            multiline
          />

          <Text style={styles.label}>Photo</Text>
          {photo ? (
            <View>
              <Image source={{ uri: photo }} style={styles.photo} />
              <Pressable onPress={() => setPhoto(null)} style={styles.removePhoto} accessibilityLabel="Remove photo">
                <Ionicons name="trash-outline" size={14} color="#fff" />
                <Text style={styles.removeText}>Remove</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable style={styles.photoBtn} onPress={async () => setPhoto(await takePhoto())}>
              <View style={styles.photoIcon}>
                <Ionicons name="camera-outline" size={24} color={colors.accent} />
              </View>
              <Text style={styles.photoBtnText}>Add a photo</Text>
              <Text style={styles.photoBtnSub}>Camera, or photo library on the simulator</Text>
            </Pressable>
          )}

          <View style={styles.hintRow}>
            <Ionicons name="phone-portrait-outline" size={14} color={colors.muted} />
            <Text style={styles.hint}>Saved to this device first. Works with no signal.</Text>
          </View>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.card,
  },
  iconBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  heading: { fontSize: 17, fontWeight: '700', color: colors.ink },
  saveBtn: { backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 8 },
  saveBtnOff: { backgroundColor: colors.line },
  saveText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  saveTextOff: { color: colors.faint },
  form: { padding: 16, paddingBottom: 40, gap: 8 },
  label: { fontSize: 12, fontWeight: '700', color: colors.muted, marginTop: 12, textTransform: 'uppercase', letterSpacing: 0.8 },
  input: {
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.ink,
    borderWidth: 1,
    borderColor: colors.line,
  },
  titleInput: { fontSize: 17, fontWeight: '500' },
  multiline: { minHeight: 100, textAlignVertical: 'top' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.line,
  },
  tileIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tileText: { fontSize: 15, fontWeight: '600', color: colors.ink },
  photoBtn: {
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.faint,
    backgroundColor: colors.card,
    paddingVertical: 24,
    alignItems: 'center',
    gap: 4,
  },
  photoIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  photoBtnText: { fontSize: 15, fontWeight: '600', color: colors.ink },
  photoBtnSub: { fontSize: 13, color: colors.muted },
  photo: { width: '100%', height: 220, borderRadius: 16 },
  removePhoto: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(22, 24, 29, 0.7)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    boxShadow: shadow,
  },
  removeText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  hint: { fontSize: 13, color: colors.muted },
});
