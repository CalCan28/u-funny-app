import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { G, Path, Circle } from 'react-native-svg';
import { getStyleProfile, StyleProfile, COMEDY_TYPES, ComedyTypeKey } from './feedbackService';

const colors = {
  background: '#f5f1e8',
  cardBg: '#fdfcfa',
  cardBorder: '#d9d1c3',
  primary: '#6b8e6f',
  accent: '#e8b944',
  textDark: '#5c4a3a',
  textMuted: '#9b8b7a',
  star: '#f4c430',
};

// Colors for each comedy type
const COMEDY_TYPE_COLORS: Record<ComedyTypeKey, string> = {
  storyteller: '#6b8e6f',      // Primary green
  oneLinerSniper: '#e8b944',   // Accent gold
  crowdController: '#7eb8c9',  // Teal
  wordWizard: '#c97e7e',       // Coral
  vibeTechnician: '#9b7ec9',   // Purple
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PIE_SIZE = Math.min(SCREEN_WIDTH - 80, 180);

interface ComedyStyleProfileProps {
  userId: string;
  onViewTipsCritiques?: () => void;
}

export default function ComedyStyleProfile({ userId, onViewTipsCritiques }: ComedyStyleProfileProps) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<StyleProfile | null>(null);
  const [selectedSlice, setSelectedSlice] = useState<ComedyTypeKey | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const result = await getStyleProfile(userId);
        setProfile(result);
      } catch (error) {
        console.error('Error fetching style profile:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [userId]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  if (!profile || profile.sampleSize === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="bar-chart-outline" size={40} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>No Reviews Yet</Text>
        <Text style={styles.emptyText}>
          Upload clips and get feedback to see your comedy style profile
        </Text>
      </View>
    );
  }

  // Prepare pie chart data
  const pieData = COMEDY_TYPES.map(type => ({
    key: type.key,
    label: type.label,
    description: type.description,
    percentage: profile.typeBreakdownPercent[type.key],
    color: COMEDY_TYPE_COLORS[type.key],
  }));

  // Create pie chart slices
  const createPieSlice = (
    startAngle: number,
    endAngle: number,
    color: string,
    isSelected: boolean
  ) => {
    const radius = PIE_SIZE / 2 - 10;
    const centerX = PIE_SIZE / 2;
    const centerY = PIE_SIZE / 2;
    const scale = isSelected ? 1.08 : 1;

    const startRad = (startAngle - 90) * (Math.PI / 180);
    const endRad = (endAngle - 90) * (Math.PI / 180);

    const x1 = centerX + radius * scale * Math.cos(startRad);
    const y1 = centerY + radius * scale * Math.sin(startRad);
    const x2 = centerX + radius * scale * Math.cos(endRad);
    const y2 = centerY + radius * scale * Math.sin(endRad);

    const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;

    const d = [
      `M ${centerX} ${centerY}`,
      `L ${x1} ${y1}`,
      `A ${radius * scale} ${radius * scale} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
      'Z',
    ].join(' ');

    return d;
  };

  let currentAngle = 0;
  const pieSlices = pieData.map((slice) => {
    const angle = (slice.percentage / 100) * 360;
    const startAngle = currentAngle;
    currentAngle += angle;
    const isSelected = selectedSlice === slice.key;
    return {
      ...slice,
      path: createPieSlice(startAngle, currentAngle, slice.color, isSelected),
      midAngle: startAngle + angle / 2,
    };
  });

  const handleSlicePress = (key: ComedyTypeKey) => {
    setSelectedSlice(prev => prev === key ? null : key);
  };

  const primaryType = COMEDY_TYPES.find(t => t.key === profile.primaryStyle);
  const secondaryType = COMEDY_TYPES.find(t => t.key === profile.secondaryStyle);

  const renderStars = (rating: number) => {
    const fullStars = Math.floor(rating);
    const hasHalf = rating % 1 >= 0.5;
    const stars = [];

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(<Ionicons key={i} name="star" size={14} color={colors.star} />);
      } else if (i === fullStars && hasHalf) {
        stars.push(<Ionicons key={i} name="star-half" size={14} color={colors.star} />);
      } else {
        stars.push(<Ionicons key={i} name="star-outline" size={14} color={colors.star} />);
      }
    }
    return stars;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Comedy Style Profile</Text>

      {profile.isEarlyRead && (
        <View style={styles.earlyReadBadge}>
          <Ionicons name="information-circle" size={14} color={colors.accent} />
          <Text style={styles.earlyReadText}>
            Early read - {profile.sampleSize} review{profile.sampleSize !== 1 ? 's' : ''}
          </Text>
        </View>
      )}

      {/* Overall Score Section */}
      <View style={styles.overallSection}>
        <View style={styles.overallScoreCircle}>
          <Text style={styles.overallScore}>{Math.round(profile.overall100)}</Text>
        </View>
        <View style={styles.overallInfo}>
          <Text style={styles.overallLabel}>Overall Score</Text>
          <View style={styles.starsRow}>
            {renderStars(profile.overallStars)}
            <Text style={styles.starsText}>{profile.overallStars.toFixed(1)}</Text>
          </View>
        </View>
      </View>

      {/* Primary & Secondary Styles */}
      <View style={styles.stylesSection}>
        <View style={styles.styleItem}>
          <View style={[styles.styleDot, { backgroundColor: COMEDY_TYPE_COLORS[profile.primaryStyle] }]} />
          <View>
            <Text style={styles.styleLabel}>Primary Style</Text>
            <Text style={styles.styleValue}>{primaryType?.label}</Text>
          </View>
        </View>
        <View style={styles.styleItem}>
          <View style={[styles.styleDot, { backgroundColor: COMEDY_TYPE_COLORS[profile.secondaryStyle] }]} />
          <View>
            <Text style={styles.styleLabel}>Secondary</Text>
            <Text style={styles.styleValue}>{secondaryType?.label}</Text>
          </View>
        </View>
      </View>

      {/* Pie Chart */}
      <View style={styles.pieContainer}>
        <Svg width={PIE_SIZE} height={PIE_SIZE}>
          <G>
            {pieSlices.map((slice) => (
              <Path
                key={slice.key}
                d={slice.path}
                fill={slice.color}
                opacity={selectedSlice && selectedSlice !== slice.key ? 0.4 : 1}
                onPress={() => handleSlicePress(slice.key)}
              />
            ))}
          </G>
          <Circle
            cx={PIE_SIZE / 2}
            cy={PIE_SIZE / 2}
            r={PIE_SIZE / 4.5}
            fill={colors.cardBg}
          />
        </Svg>

        {/* Selected slice info */}
        {selectedSlice && (
          <View style={styles.selectedInfo}>
            <Text style={styles.selectedLabel}>
              {COMEDY_TYPES.find(t => t.key === selectedSlice)?.label}
            </Text>
            <Text style={styles.selectedPercent}>
              {profile.typeBreakdownPercent[selectedSlice].toFixed(0)}%
            </Text>
            <Text style={styles.selectedDesc}>
              {COMEDY_TYPES.find(t => t.key === selectedSlice)?.description}
            </Text>
          </View>
        )}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        {pieData.map((item) => (
          <TouchableOpacity
            key={item.key}
            style={[
              styles.legendItem,
              selectedSlice === item.key && styles.legendItemSelected,
            ]}
            onPress={() => handleSlicePress(item.key)}
          >
            <View style={[styles.legendDot, { backgroundColor: item.color }]} />
            <Text style={styles.legendLabel}>{item.label}</Text>
            <Text style={styles.legendValue}>{item.percentage.toFixed(0)}%</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Strength & Focus */}
      <View style={styles.insightsSection}>
        <View style={styles.insightRow}>
          <View style={styles.insightIcon}>
            <Ionicons name="trophy" size={16} color={colors.primary} />
          </View>
          <View>
            <Text style={styles.insightLabel}>Strength</Text>
            <Text style={styles.insightValue}>{profile.strengthCategory}</Text>
          </View>
        </View>
        <View style={styles.insightRow}>
          <View style={styles.insightIconFocus}>
            <Ionicons name="arrow-up" size={16} color={colors.accent} />
          </View>
          <View>
            <Text style={styles.insightLabel}>Focus Area</Text>
            <Text style={styles.insightValue}>{profile.focusCategory}</Text>
          </View>
        </View>
      </View>

      {/* Sample Size */}
      <Text style={styles.sampleSize}>
        Based on {profile.sampleSize} review{profile.sampleSize !== 1 ? 's' : ''}
      </Text>

      {/* View Tips & Critiques Button */}
      {onViewTipsCritiques && (
        <TouchableOpacity style={styles.viewButton} onPress={onViewTipsCritiques}>
          <Text style={styles.viewButtonText}>View Tips & Critiques</Text>
          <Ionicons name="arrow-forward" size={16} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  loadingContainer: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  emptyContainer: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textDark,
    marginTop: 12,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textDark,
    textAlign: 'center',
    marginBottom: 8,
  },
  earlyReadBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: 'rgba(232, 185, 68, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'center',
    marginBottom: 16,
  },
  earlyReadText: {
    fontSize: 12,
    color: colors.accent,
    fontWeight: '500',
  },
  overallSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 20,
  },
  overallScoreCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overallScore: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  overallInfo: {},
  overallLabel: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 4,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  starsText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textDark,
  },
  stylesSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: 16,
  },
  styleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  styleDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  styleLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  styleValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textDark,
  },
  pieContainer: {
    alignItems: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  selectedInfo: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -50 }, { translateY: -35 }],
    alignItems: 'center',
    width: 100,
  },
  selectedLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textDark,
    textAlign: 'center',
  },
  selectedPercent: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textDark,
  },
  selectedDesc: {
    fontSize: 9,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 2,
  },
  legend: {
    marginBottom: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  legendItemSelected: {
    backgroundColor: colors.background,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  legendLabel: {
    flex: 1,
    fontSize: 13,
    color: colors.textDark,
  },
  legendValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textDark,
  },
  insightsSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: 12,
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  insightIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(107, 142, 111, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  insightIconFocus: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(232, 185, 68, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  insightLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  insightValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textDark,
  },
  sampleSize: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 12,
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  viewButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
