import { useState, useEffect } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';

const colors = {
  primary: '#6b8e6f',
  cardBg: '#fdfcfa',
  cardBorder: '#d9d1c3',
  textDark: '#5c4a3a',
  textMuted: '#9b8b7a',
};

type AudienceButtonProps = {
  comedianId: string;
  comedianName?: string;
  initialInAudience?: boolean;
  size?: 'small' | 'medium' | 'large';
  onToggle?: (inAudience: boolean) => void;
};

export default function AudienceButton({
  comedianId,
  comedianName,
  initialInAudience = false,
  size = 'medium',
  onToggle,
}: AudienceButtonProps) {
  const { user } = useAuth();
  const [inAudience, setInAudience] = useState(initialInAudience);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  // Check if user is already in audience on mount
  useEffect(() => {
    const checkAudienceStatus = async () => {
      if (!user || user.id === comedianId) {
        setChecking(false);
        return;
      }

      try {
        const { data } = await supabase
          .from('audience_members')
          .select('id')
          .eq('comedian_id', comedianId)
          .eq('audience_member_id', user.id)
          .single();

        setInAudience(!!data);
      } catch (error) {
        // No row found means not in audience
        setInAudience(false);
      } finally {
        setChecking(false);
      }
    };

    checkAudienceStatus();
  }, [user, comedianId]);

  const handleToggle = async () => {
    if (!user || loading || user.id === comedianId) return;

    setLoading(true);

    try {
      if (inAudience) {
        // Leave audience
        const { error } = await supabase
          .from('audience_members')
          .delete()
          .eq('comedian_id', comedianId)
          .eq('audience_member_id', user.id);

        if (error) throw error;
        setInAudience(false);
        onToggle?.(false);
      } else {
        // Join audience
        const { error } = await supabase
          .from('audience_members')
          .insert({
            comedian_id: comedianId,
            audience_member_id: user.id,
          });

        if (error) throw error;
        setInAudience(true);
        onToggle?.(true);
      }
    } catch (error) {
      console.error('Error toggling audience:', error);
    } finally {
      setLoading(false);
    }
  };

  // Don't show button for own profile
  if (user?.id === comedianId) {
    return null;
  }

  const sizeStyles = {
    small: styles.buttonSmall,
    medium: styles.buttonMedium,
    large: styles.buttonLarge,
  };

  const textSizeStyles = {
    small: styles.textSmall,
    medium: styles.textMedium,
    large: styles.textLarge,
  };

  if (checking) {
    return (
      <TouchableOpacity
        style={[styles.button, sizeStyles[size], styles.buttonLoading]}
        disabled
      >
        <ActivityIndicator size="small" color={colors.textMuted} />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[
        styles.button,
        sizeStyles[size],
        inAudience ? styles.buttonJoined : styles.buttonNotJoined,
      ]}
      onPress={handleToggle}
      disabled={loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator size="small" color={inAudience ? '#fff' : colors.primary} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            textSizeStyles[size],
            inAudience ? styles.textJoined : styles.textNotJoined,
          ]}
        >
          {inAudience ? '✓ In Audience' : '🎭 Join Audience'}
        </Text>
      )}
    </TouchableOpacity>
  );
}

type AudienceCountProps = {
  count: number;
  size?: 'small' | 'medium';
};

export function AudienceCount({ count, size = 'medium' }: AudienceCountProps) {
  const formatCount = (n: number) => {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
  };

  return (
    <Text style={[styles.audienceCount, size === 'small' && styles.audienceCountSmall]}>
      🎭 {formatCount(count)} {count === 1 ? 'audience member' : 'audience members'}
    </Text>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  buttonSmall: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 90,
  },
  buttonMedium: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 120,
  },
  buttonLarge: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    minWidth: 160,
  },
  buttonNotJoined: {
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  buttonJoined: {
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  buttonLoading: {
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  buttonText: {
    fontWeight: '600',
  },
  textSmall: {
    fontSize: 11,
  },
  textMedium: {
    fontSize: 13,
  },
  textLarge: {
    fontSize: 15,
  },
  textNotJoined: {
    color: colors.primary,
  },
  textJoined: {
    color: '#fff',
  },
  audienceCount: {
    fontSize: 13,
    color: colors.textMuted,
  },
  audienceCountSmall: {
    fontSize: 11,
  },
});
