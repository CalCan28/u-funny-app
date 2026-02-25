import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Animated,
  Dimensions,
  Alert,
} from 'react-native';

const { width } = Dimensions.get('window');

// Design colors - Matching app theme
const colors = {
  background: '#f5f1e8',
  cardBg: '#fdfcfa',
  cardBorder: '#d9d1c3',
  primary: '#6b8e6f',
  accent: '#e8b944',
  textDark: '#5c4a3a',
  textMuted: '#9b8b7a',
  premium: '#6b8e6f',      // Using primary green
  premiumDark: '#5a7a5e',  // Darker green
  premiumLight: 'rgba(107, 142, 111, 0.1)',
  gold: '#e8b944',         // Using app accent
  success: '#6b8e6f',
};

// ============================================
// PRICING CONFIGURATION (Easy to update)
// ============================================
const PRICING = {
  monthly: {
    price: 9.99,
    currency: '$',
    period: 'month',
    label: 'Monthly',
  },
  annual: {
    price: 79.99,
    currency: '$',
    period: 'year',
    label: 'Annual',
    monthlyEquivalent: 6.67,
    savings: 40, // percentage saved
  },
  trialDays: 7,
};

// ============================================
// FEATURE DATA
// ============================================
type Feature = {
  id: string;
  icon: string;
  title: string;
  description: string;
  highlight?: boolean;
};

const PREMIUM_FEATURES: Feature[] = [
  {
    id: 'recording',
    icon: '🎙️',
    title: 'Set Recording & Timing',
    description: 'Record yourself performing your set with a built-in timer. Perfect for practice sessions and tracking your delivery timing.',
  },
  {
    id: 'ai',
    icon: '🤖',
    title: 'AI Set Assistance',
    description: 'Get intelligent suggestions for improving your material, punching up punchlines, and generating new ideas based on your style.',
    highlight: true,
  },
  {
    id: 'routine',
    icon: '📋',
    title: 'Routine Development',
    description: 'Organize all your developed bits into complete sets. Drag, drop, and arrange bits to create perfect 5, 10, or custom-length routines.',
  },
  {
    id: 'practice',
    icon: '⏱️',
    title: 'Practice Mode with Timer',
    description: 'Record yourself performing with a visual countdown timer. Review your recordings and track improvement over time.',
  },
  {
    id: 'social',
    icon: '👥',
    title: 'Social Sharing',
    description: 'Share your bits with friends and fellow comedians. Get feedback, collaborate, and build your comedy community.',
  },
];

const FREE_VS_PREMIUM = [
  { feature: 'Create & Save Bits', free: true, premium: true },
  { feature: 'Basic Tags & Categories', free: true, premium: true },
  { feature: 'Performance Time Calculator', free: true, premium: true },
  { feature: 'Unlimited Custom Tags', free: false, premium: true },
  { feature: 'AI Writing Assistant', free: false, premium: true },
  { feature: 'AI Punchline Suggestions', free: false, premium: true },
  { feature: 'Routine Builder', free: false, premium: true },
  { feature: 'Set Recording', free: false, premium: true },
  { feature: 'Practice Timer', free: false, premium: true },
  { feature: 'Social Sharing', free: false, premium: true },
  { feature: 'Priority Support', free: false, premium: true },
];

// ============================================
// ANIMATED COMPONENTS
// ============================================

type FeatureCardProps = {
  feature: Feature;
  index: number;
};

function FeatureCard({ feature, index }: FeatureCardProps) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        delay: index * 100,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay: index * 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.featureCard,
        feature.highlight && styles.featureCardHighlight,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      {feature.highlight && (
        <View style={styles.popularBadge}>
          <Text style={styles.popularBadgeText}>MOST POPULAR</Text>
        </View>
      )}
      <View style={styles.featureIconContainer}>
        <Text style={styles.featureIcon}>{feature.icon}</Text>
      </View>
      <Text style={styles.featureTitle}>{feature.title}</Text>
      <Text style={styles.featureDescription}>{feature.description}</Text>
    </Animated.View>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

type GoPremiumScreenProps = {
  navigation: any;
  route?: any;
  // Props for external subscription status check
  isPremium?: boolean;
  onUpgrade?: (plan: 'monthly' | 'annual') => void;
};

export default function GoPremiumScreen({
  navigation,
  route,
  isPremium = false,
  onUpgrade,
}: GoPremiumScreenProps) {
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('annual');
  const [showComparison, setShowComparison] = useState(false);

  // Animation refs
  const heroAnim = useRef(new Animated.Value(0)).current;
  const ctaAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(heroAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(ctaAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleUpgrade = () => {
    if (onUpgrade) {
      onUpgrade(selectedPlan);
    } else {
      Alert.alert(
        'Coming Soon!',
        'Premium subscriptions are launching soon. We\'ll notify you when it\'s ready!',
        [{ text: 'Got it', style: 'default' }]
      );
    }
  };

  const selectedPrice = selectedPlan === 'monthly' ? PRICING.monthly : PRICING.annual;

  // If already premium, show different UI
  if (isPremium) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.alreadyPremiumContainer}>
          <Text style={styles.premiumCrown}>👑</Text>
          <Text style={styles.alreadyPremiumTitle}>You're Already Premium!</Text>
          <Text style={styles.alreadyPremiumText}>
            Thank you for being a premium member. Enjoy all the features!
          </Text>
          <TouchableOpacity
            style={styles.manageButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.manageButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.premiumBadgeHeader}>
          <Text style={styles.premiumBadgeHeaderText}>PRO</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <Animated.View
          style={[
            styles.heroSection,
            {
              opacity: heroAnim,
              transform: [{
                translateY: heroAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-20, 0],
                }),
              }],
            },
          ]}
        >
          <Text style={styles.heroCrown}>👑</Text>
          <Text style={styles.heroTitle}>Take Your Comedy{'\n'}to the Next Level</Text>
          <Text style={styles.heroSubtitle}>
            Professional tools for serious comedians who want to write better, perform stronger, and grow faster.
          </Text>
        </Animated.View>

        {/* Premium Features */}
        <View style={styles.featuresSection}>
          <Text style={styles.sectionTitle}>Premium Features</Text>
          {PREMIUM_FEATURES.map((feature, index) => (
            <FeatureCard key={feature.id} feature={feature} index={index} />
          ))}
        </View>

        {/* Pricing Section */}
        <View style={styles.pricingSection}>
          <Text style={styles.sectionTitle}>Choose Your Plan</Text>

          {/* Plan Toggle */}
          <View style={styles.planToggle}>
            <TouchableOpacity
              style={[
                styles.planOption,
                selectedPlan === 'monthly' && styles.planOptionSelected,
              ]}
              onPress={() => setSelectedPlan('monthly')}
            >
              <Text style={[
                styles.planOptionText,
                selectedPlan === 'monthly' && styles.planOptionTextSelected,
              ]}>
                Monthly
              </Text>
              <Text style={[
                styles.planPrice,
                selectedPlan === 'monthly' && styles.planPriceSelected,
              ]}>
                {PRICING.monthly.currency}{PRICING.monthly.price}/{PRICING.monthly.period}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.planOption,
                selectedPlan === 'annual' && styles.planOptionSelected,
              ]}
              onPress={() => setSelectedPlan('annual')}
            >
              <View style={styles.savingsBadge}>
                <Text style={styles.savingsBadgeText}>SAVE {PRICING.annual.savings}%</Text>
              </View>
              <Text style={[
                styles.planOptionText,
                selectedPlan === 'annual' && styles.planOptionTextSelected,
              ]}>
                Annual
              </Text>
              <Text style={[
                styles.planPrice,
                selectedPlan === 'annual' && styles.planPriceSelected,
              ]}>
                {PRICING.annual.currency}{PRICING.annual.price}/{PRICING.annual.period}
              </Text>
              <Text style={styles.monthlyEquivalent}>
                Just {PRICING.annual.currency}{PRICING.annual.monthlyEquivalent}/month
              </Text>
            </TouchableOpacity>
          </View>

          {/* Pricing Note */}
          <Text style={styles.pricingNote}>
            Pricing competitive with industry-standard AI-assisted creative tools
          </Text>
        </View>

        {/* CTA Section */}
        <Animated.View
          style={[
            styles.ctaSection,
            {
              opacity: ctaAnim,
              transform: [{ scale: ctaAnim }],
            },
          ]}
        >
          <TouchableOpacity style={styles.upgradeButton} onPress={handleUpgrade}>
            <Text style={styles.upgradeButtonText}>
              Start {PRICING.trialDays}-Day Free Trial
            </Text>
          </TouchableOpacity>

          <Text style={styles.trialText}>
            Then {selectedPrice.currency}{selectedPrice.price}/{selectedPrice.period}
          </Text>

          {/* Trust Indicators */}
          <View style={styles.trustIndicators}>
            <View style={styles.trustItem}>
              <Text style={styles.trustIcon}>🔒</Text>
              <Text style={styles.trustText}>Secure Payment</Text>
            </View>
            <View style={styles.trustItem}>
              <Text style={styles.trustIcon}>↩️</Text>
              <Text style={styles.trustText}>Cancel Anytime</Text>
            </View>
            <View style={styles.trustItem}>
              <Text style={styles.trustIcon}>💳</Text>
              <Text style={styles.trustText}>No Hidden Fees</Text>
            </View>
          </View>
        </Animated.View>

        {/* Comparison Toggle */}
        <TouchableOpacity
          style={styles.comparisonToggle}
          onPress={() => setShowComparison(!showComparison)}
        >
          <Text style={styles.comparisonToggleText}>
            {showComparison ? 'Hide' : 'Show'} Free vs Premium Comparison
          </Text>
          <Text style={styles.comparisonArrow}>{showComparison ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        {/* Comparison Table */}
        {showComparison && (
          <View style={styles.comparisonSection}>
            <View style={styles.comparisonHeader}>
              <Text style={styles.comparisonHeaderText}>Feature</Text>
              <Text style={styles.comparisonHeaderFree}>Free</Text>
              <Text style={styles.comparisonHeaderPremium}>Pro</Text>
            </View>
            {FREE_VS_PREMIUM.map((item, index) => (
              <View
                key={index}
                style={[
                  styles.comparisonRow,
                  index % 2 === 0 && styles.comparisonRowAlt,
                ]}
              >
                <Text style={styles.comparisonFeature}>{item.feature}</Text>
                <Text style={styles.comparisonCheck}>
                  {item.free ? '✓' : '—'}
                </Text>
                <Text style={[styles.comparisonCheck, styles.comparisonCheckPremium]}>
                  {item.premium ? '✓' : '—'}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Testimonials */}
        <View style={styles.testimonialSection}>
          <Text style={styles.testimonialTitle}>What Comedians Say</Text>
          <View style={styles.testimonialCard}>
            <Text style={styles.testimonialQuote}>
              "The AI suggestions helped me punch up my bits in ways I never thought of. Worth every penny!"
            </Text>
            <Text style={styles.testimonialAuthor}>— Sarah M., Stand-up Comedian</Text>
          </View>
          <View style={styles.testimonialCard}>
            <Text style={styles.testimonialQuote}>
              "The routine builder saved me hours of organization. Now I can focus on being funny."
            </Text>
            <Text style={styles.testimonialAuthor}>— Mike T., Open Mic Regular</Text>
          </View>
        </View>

        {/* FAQ */}
        <View style={styles.faqSection}>
          <Text style={styles.faqTitle}>Frequently Asked Questions</Text>

          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>Can I cancel anytime?</Text>
            <Text style={styles.faqAnswer}>
              Yes! You can cancel your subscription at any time from your account settings. You'll keep access until the end of your billing period.
            </Text>
          </View>

          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>What happens after the free trial?</Text>
            <Text style={styles.faqAnswer}>
              After your {PRICING.trialDays}-day free trial, you'll be automatically charged unless you cancel. We'll send a reminder before charging.
            </Text>
          </View>

          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>Can I switch plans later?</Text>
            <Text style={styles.faqAnswer}>
              Absolutely! You can upgrade from monthly to annual (and save!) or downgrade anytime from your account settings.
            </Text>
          </View>
        </View>

        {/* Final CTA */}
        <View style={styles.finalCta}>
          <Text style={styles.finalCtaText}>Ready to level up your comedy?</Text>
          <TouchableOpacity style={styles.upgradeButton} onPress={handleUpgrade}>
            <Text style={styles.upgradeButtonText}>
              Get Started Now
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  backText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
  },
  premiumBadgeHeader: {
    backgroundColor: colors.premium,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  premiumBadgeHeaderText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  scrollContent: {
    flex: 1,
  },
  // Hero Section
  heroSection: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
    backgroundColor: colors.premium,
  },
  heroCrown: {
    fontSize: 48,
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    lineHeight: 36,
    marginBottom: 12,
  },
  heroSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 300,
  },
  // Features Section
  featuresSection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.textDark,
    textAlign: 'center',
    marginBottom: 20,
  },
  featureCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  featureCardHighlight: {
    borderColor: colors.premium,
    borderWidth: 2,
    backgroundColor: colors.premiumLight,
  },
  popularBadge: {
    position: 'absolute',
    top: -10,
    right: 16,
    backgroundColor: colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  popularBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.textDark,
  },
  featureIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.premiumLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  featureIcon: {
    fontSize: 28,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textDark,
    marginBottom: 8,
  },
  featureDescription: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 22,
  },
  // Pricing Section
  pricingSection: {
    padding: 20,
    backgroundColor: colors.cardBg,
  },
  planToggle: {
    flexDirection: 'row',
    gap: 12,
  },
  planOption: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.cardBorder,
    position: 'relative',
  },
  planOptionSelected: {
    borderColor: colors.premium,
    backgroundColor: colors.premiumLight,
  },
  savingsBadge: {
    position: 'absolute',
    top: -10,
    backgroundColor: colors.success,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  savingsBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  planOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 8,
  },
  planOptionTextSelected: {
    color: colors.premium,
  },
  planPrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textDark,
  },
  planPriceSelected: {
    color: colors.premiumDark,
  },
  monthlyEquivalent: {
    fontSize: 12,
    color: colors.success,
    marginTop: 4,
    fontWeight: '600',
  },
  pricingNote: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 16,
    fontStyle: 'italic',
  },
  // CTA Section
  ctaSection: {
    padding: 24,
    alignItems: 'center',
  },
  upgradeButton: {
    backgroundColor: colors.premium,
    paddingVertical: 18,
    paddingHorizontal: 48,
    borderRadius: 30,
    shadowColor: colors.premium,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    width: '100%',
    alignItems: 'center',
  },
  upgradeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  trialText: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 12,
  },
  trustIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
    gap: 20,
  },
  trustItem: {
    alignItems: 'center',
  },
  trustIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  trustText: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
  },
  // Comparison Section
  comparisonToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  comparisonToggleText: {
    fontSize: 14,
    color: colors.premium,
    fontWeight: '600',
  },
  comparisonArrow: {
    fontSize: 12,
    color: colors.premium,
  },
  comparisonSection: {
    marginHorizontal: 16,
    marginBottom: 24,
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  comparisonHeader: {
    flexDirection: 'row',
    backgroundColor: colors.premium,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  comparisonHeaderText: {
    flex: 2,
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  comparisonHeaderFree: {
    flex: 1,
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
    textAlign: 'center',
  },
  comparisonHeaderPremium: {
    flex: 1,
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
    textAlign: 'center',
  },
  comparisonRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  comparisonRowAlt: {
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  comparisonFeature: {
    flex: 2,
    fontSize: 13,
    color: colors.textDark,
  },
  comparisonCheck: {
    flex: 1,
    fontSize: 16,
    textAlign: 'center',
    color: colors.textMuted,
  },
  comparisonCheckPremium: {
    color: colors.success,
    fontWeight: 'bold',
  },
  // Testimonials
  testimonialSection: {
    padding: 20,
  },
  testimonialTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textDark,
    textAlign: 'center',
    marginBottom: 16,
  },
  testimonialCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderLeftWidth: 4,
    borderLeftColor: colors.premium,
  },
  testimonialQuote: {
    fontSize: 15,
    color: colors.textDark,
    lineHeight: 24,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  testimonialAuthor: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
  },
  // FAQ
  faqSection: {
    padding: 20,
    backgroundColor: colors.cardBg,
  },
  faqTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textDark,
    textAlign: 'center',
    marginBottom: 20,
  },
  faqItem: {
    marginBottom: 20,
  },
  faqQuestion: {
    fontSize: 15,
    fontWeight: 'bold',
    color: colors.textDark,
    marginBottom: 8,
  },
  faqAnswer: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 22,
  },
  // Final CTA
  finalCta: {
    padding: 24,
    alignItems: 'center',
  },
  finalCtaText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textDark,
    marginBottom: 16,
    textAlign: 'center',
  },
  // Already Premium
  alreadyPremiumContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  premiumCrown: {
    fontSize: 64,
    marginBottom: 24,
  },
  alreadyPremiumTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.premium,
    marginBottom: 12,
  },
  alreadyPremiumText: {
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 32,
  },
  manageButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  manageButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  bottomPadding: {
    height: 40,
  },
});
