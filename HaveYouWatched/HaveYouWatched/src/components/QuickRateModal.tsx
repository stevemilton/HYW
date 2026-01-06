import { useState } from 'react';
import {
    Modal,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { RatingData, ShowData, upsertRating, upsertShow } from '../lib/db';
import { getCurrentUserId } from '../lib/dev';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { colors, radius, spacing } from '../ui/theme';

const AVAILABLE_TAGS = ['easy watch', 'slow burn', 'couples', 'smart TV'];

type Sentiment = 'loved' | 'ok' | 'not_for_me';

interface SentimentDefaults {
  enjoyment: number;
  hook: number;
  consistency: number;
  payoff: number;
  heat: number;
  recommend: boolean;
}

function getSentimentDefaults(sentiment: Sentiment): SentimentDefaults {
  switch (sentiment) {
    case 'loved':
      return {
        enjoyment: 9,
        hook: 8,
        consistency: 8,
        payoff: 8,
        heat: 7,
        recommend: true,
      };
    case 'ok':
      return {
        enjoyment: 6,
        hook: 6,
        consistency: 6,
        payoff: 6,
        heat: 5,
        recommend: true,
      };
    case 'not_for_me':
      return {
        enjoyment: 3,
        hook: 4,
        consistency: 5,
        payoff: 4,
        heat: 4,
        recommend: false,
      };
  }
}

interface QuickRateModalProps {
  visible: boolean;
  show: {
    id: number | string;
    title?: string;
    name?: string;
    overview?: string;
    poster_path: string | null;
    first_air_date?: string | null;
    release_date?: string | null;
  };
  onClose: () => void;
  onSave: () => void;
}

export default function QuickRateModal({
  visible,
  show,
  onClose,
  onSave,
}: QuickRateModalProps) {
  const [simpleSentiment, setSimpleSentiment] = useState<Sentiment | null>(null);
  const [recommend, setRecommend] = useState(true);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSentimentSelect = (sentiment: Sentiment) => {
    setSimpleSentiment(sentiment);
    const defaults = getSentimentDefaults(sentiment);
    setRecommend(defaults.recommend);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSave = async () => {
    if (!simpleSentiment) {
      return;
    }

    setLoading(true);
    try {
      const defaults = getSentimentDefaults(simpleSentiment);

      const showData: ShowData = {
        id: show.id.toString(),
        title: (show.title || show.name || 'Unknown') as string,
        poster_path: show.poster_path,
        overview: show.overview || '',
        first_air_date: show.first_air_date || show.release_date || null,
      };

      await upsertShow(showData);

      const userId = await getCurrentUserId();

      const ratingData: RatingData = {
        user_id: userId,
        show_id: show.id.toString(),
        hook: defaults.hook,
        consistency: defaults.consistency,
        payoff: defaults.payoff,
        heat: defaults.heat,
        enjoyment: defaults.enjoyment,
        recommend,
        tags: selectedTags,
      };

      await upsertRating(ratingData);

      // Reset state
      setSimpleSentiment(null);
      setRecommend(true);
      setSelectedTags([]);

      onSave();
      onClose();
    } catch (error: any) {
      console.error('Failed to save rating:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <Card style={styles.modalContent}>
          <View>
            <Text style={styles.modalTitle}>Quick rate</Text>

          {/* Sentiment Pills */}
          <View style={styles.sentimentContainer}>
            <TouchableOpacity
              style={[
                styles.sentimentPill,
                simpleSentiment === 'loved' && styles.sentimentPillSelected,
              ]}
              onPress={() => handleSentimentSelect('loved')}
              disabled={loading}>
              <Text
                style={[
                  styles.sentimentPillText,
                  simpleSentiment === 'loved' && styles.sentimentPillTextSelected,
                ]}>
                Loved
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.sentimentPill,
                simpleSentiment === 'ok' && styles.sentimentPillSelected,
              ]}
              onPress={() => handleSentimentSelect('ok')}
              disabled={loading}>
              <Text
                style={[
                  styles.sentimentPillText,
                  simpleSentiment === 'ok' && styles.sentimentPillTextSelected,
                ]}>
                It was OK
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.sentimentPill,
                simpleSentiment === 'not_for_me' && styles.sentimentPillSelected,
              ]}
              onPress={() => handleSentimentSelect('not_for_me')}
              disabled={loading}>
              <Text
                style={[
                  styles.sentimentPillText,
                  simpleSentiment === 'not_for_me' &&
                    styles.sentimentPillTextSelected,
                ]}>
                Not for me
              </Text>
            </TouchableOpacity>
          </View>

          {/* Recommend Switch */}
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Recommend</Text>
            <Switch
              value={recommend}
              onValueChange={setRecommend}
              disabled={loading}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.card}
            />
          </View>

          {/* Tags */}
          <View style={styles.tagsSection}>
            <Text style={styles.tagsLabel}>Add tags (optional)</Text>
            <View style={styles.tagsContainer}>
              {AVAILABLE_TAGS.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <TouchableOpacity
                    key={tag}
                    style={[
                      styles.tag,
                      isSelected ? styles.tagSelected : styles.tagOutline,
                    ]}
                    onPress={() => toggleTag(tag)}
                    disabled={loading}>
                    <Text
                      style={[
                        styles.tagText,
                        isSelected && styles.tagTextSelected,
                      ]}>
                      {tag}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Save Button */}
          <Button
            variant="primary"
            onPress={handleSave}
            loading={loading}
            disabled={loading || !simpleSentiment}
            style={styles.saveButton}>
            Save rating
          </Button>
          </View>
        </Card>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContent: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    padding: spacing.lg,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  sentimentContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
    flexWrap: 'wrap',
  },
  sentimentPill: {
    flex: 1,
    minWidth: 100,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sentimentPillSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  sentimentPillText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  sentimentPillTextSelected: {
    color: '#fff',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  tagsSection: {
    marginBottom: spacing.lg,
  },
  tagsLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  tag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.md,
  },
  tagOutline: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'transparent',
  },
  tagSelected: {
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  tagText: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '500',
  },
  tagTextSelected: {
    color: '#fff',
  },
  saveButton: {
    marginTop: spacing.md,
  },
});

