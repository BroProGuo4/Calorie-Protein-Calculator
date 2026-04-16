import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    AppRegistry,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

const STORAGE_KEYS = {
  INGREDIENTS: '@pantry_ingredients',
  RECIPES: '@pantry_recipes',
};

const C = {
  bg: '#0f0e0c',
  surface: '#1a1814',
  card: '#221f1a',
  border: '#2e2a24',
  accent: '#e8c97a',
  accentDim: '#a8893a',
  text: '#f0ebe0',
  textMuted: '#7a7060',
  textFaint: '#3d3830',
  red: '#c0504a',
  green: '#6aab7a',
  fiber: '#7ab8c0',
};

const uid = () => Math.random().toString(36).slice(2, 10);

const calcRatio = (cal, prot) => {
  if (!prot || parseFloat(prot) === 0) return null;
  return (parseFloat(cal) / parseFloat(prot)).toFixed(2);
};

// Recompute a recipe's totals from its items (used after macro sync)
const recomputeTotals = (items) => {
  const totals = items.reduce(
    (acc, { ingredient, qty }) => {
      const factor = (parseFloat(qty) || 0) / ingredient.servingG;
      acc.cal += ingredient.calories * factor;
      acc.protein += ingredient.protein * factor;
      acc.fiber += ingredient.fiber * factor;
      return acc;
    },
    { cal: 0, protein: 0, fiber: 0 }
  );
  totals.ratio = totals.protein > 0 ? (totals.cal / totals.protein).toFixed(2) : null;
  return totals;
};

// ─── Shared UI ───────────────────────────────────────────────────────────────
function StatPill({ label, value, color }) {
  return (
    <View style={[styles.statPill, { borderColor: color + '55' }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function SectionHeader({ title, action, actionLabel }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action && (
        <TouchableOpacity onPress={action}>
          <Text style={styles.sectionAction}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function Field({ label, value, onChangeText, placeholder, keyboardType }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.textFaint}
        keyboardType={keyboardType || 'default'}
        autoCapitalize="none"
      />
    </View>
  );
}

// ─── Ingredient Picker Modal (full-screen, with search + inline gram input) ───
function IngredientPickerModal({ visible, onClose, ingredients, selected, onToggle, onSetQty }) {
  const [search, setSearch] = useState('');

  const filtered = ingredients.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.pickerContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'android' ? 24 : 0}
      >
        <StatusBar barStyle="light-content" backgroundColor={C.bg} />

        {/* Header */}
        <View style={styles.pickerHeader}>
          <Text style={styles.pickerTitle}>Add Ingredients</Text>
          <TouchableOpacity onPress={onClose} style={styles.pickerDoneBtn}>
            <Text style={styles.pickerDoneText}>Done</Text>
          </TouchableOpacity>
        </View>

        {/* Search bar */}
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search ingredients..."
            placeholderTextColor={C.textFaint}
            autoCapitalize="none"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text style={{ color: C.textMuted, fontSize: 16, paddingHorizontal: 8 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Selected count */}
        {Object.keys(selected).length > 0 && (
          <View style={styles.selectedBanner}>
            <Text style={styles.selectedBannerText}>
              {Object.keys(selected).length} ingredient{Object.keys(selected).length !== 1 ? 's' : ''} selected
            </Text>
          </View>
        )}

        {/* Ingredient list */}
        <FlatList
          data={filtered}
          keyExtractor={i => i.id}
          keyboardShouldPersistTaps="always"
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          ListEmptyComponent={
            <Text style={[styles.textMuted, { textAlign: 'center', marginTop: 40 }]}>
              {search ? 'No matches found.' : 'Pantry is empty.'}
            </Text>
          }
          renderItem={({ item }) => {
            const isSel = !!selected[item.id];
            return (
              <View style={[styles.pickerRow, isSel && styles.pickerRowSelected]}>
                {/* Tap the left side to toggle */}
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                  onPress={() => onToggle(item)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.pickerCheck, isSel && styles.pickerCheckFilled]}>
                    {isSel && <Text style={styles.pickerCheckMark}>✓</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.pickerRowName, isSel && { color: C.accent }]}>{item.name}</Text>
                    <Text style={styles.textMuted}>
                      {item.calories} kcal · {item.protein}g P · per {item.servingG}g
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Gram input — only visible when selected */}
                {isSel && (
                  <View style={styles.qtyBox}>
                    <TextInput
                      style={styles.qtyInput}
                      value={selected[item.id].qty}
                      onChangeText={v => onSetQty(item.id, v)}
                      keyboardType="decimal-pad"
                      selectTextOnFocus
                    />
                    <Text style={styles.textMuted}>g</Text>
                  </View>
                )}
              </View>
            );
          }}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Add / Edit Ingredient Modal ─────────────────────────────────────────────
function IngredientModal({ visible, onClose, onSave, editIngredient }) {
  const [name, setName] = useState('');
  const [servingG, setServingG] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [fiber, setFiber] = useState('');

  useEffect(() => {
    if (editIngredient) {
      setName(editIngredient.name);
      setServingG(String(editIngredient.servingG));
      setCalories(String(editIngredient.calories));
      setProtein(String(editIngredient.protein));
      setFiber(String(editIngredient.fiber));
    } else {
      setName(''); setServingG(''); setCalories(''); setProtein(''); setFiber('');
    }
  }, [editIngredient, visible]);

  const handleSave = () => {
    if (!name.trim() || !servingG || !calories || !protein) {
      Alert.alert('Missing fields', 'Name, serving size, calories, and protein are required.');
      return;
    }
    onSave({
      id: editIngredient?.id || uid(),
      name: name.trim(),
      servingG: parseFloat(servingG),
      calories: parseFloat(calories),
      protein: parseFloat(protein),
      fiber: parseFloat(fiber) || 0,
    });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
        keyboardVerticalOffset={Platform.OS === 'android' ? 24 : 0}
      >
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>{editIngredient ? 'Edit Ingredient' : 'New Ingredient'}</Text>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. High Protein Greek Yogurt" />
            <Field label="Serving size (g)" value={servingG} onChangeText={setServingG} placeholder="e.g. 150" keyboardType="decimal-pad" />
            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Field label="Calories" value={calories} onChangeText={setCalories} placeholder="e.g. 90" keyboardType="decimal-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Protein (g)" value={protein} onChangeText={setProtein} placeholder="e.g. 15" keyboardType="decimal-pad" />
              </View>
            </View>
            <Field label="Fiber (g) — optional" value={fiber} onChangeText={setFiber} placeholder="e.g. 0" keyboardType="decimal-pad" />
          </ScrollView>

          <View style={[styles.row, { marginTop: 16 }]}>
            <TouchableOpacity style={[styles.btn, styles.btnGhost, { flex: 1, marginRight: 8 }]} onPress={onClose}>
              <Text style={styles.btnGhostText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnAccent, { flex: 2 }]} onPress={handleSave}>
              <Text style={styles.btnAccentText}>{editIngredient ? 'Save Changes' : 'Add to Pantry'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Recipe Builder Modal ────────────────────────────────────────────────────
function RecipeBuilderModal({ visible, onClose, ingredients, onSave, editRecipe }) {
  const [name, setName] = useState('');
  // selected: { [id]: { ingredient, qty: string } }
  const [selected, setSelected] = useState({});
  const [pickerVisible, setPickerVisible] = useState(false);

  useEffect(() => {
    if (visible) {
      if (editRecipe) {
        setName(editRecipe.name);
        const sel = {};
        editRecipe.items.forEach(item => {
          // Merge with latest ingredient data from pantry if available
          const fresh = ingredients.find(i => i.id === item.ingredient.id);
          sel[item.ingredient.id] = {
            ingredient: fresh || item.ingredient,
            qty: String(item.qty),
          };
        });
        setSelected(sel);
      } else {
        setName('');
        setSelected({});
      }
    }
  }, [editRecipe, visible]);

  const toggleIngredient = (ing) => {
    setSelected(prev => {
      if (prev[ing.id]) {
        const next = { ...prev };
        delete next[ing.id];
        return next;
      }
      return { ...prev, [ing.id]: { ingredient: ing, qty: String(ing.servingG) } };
    });
  };

  const setQty = (id, val) => {
    setSelected(prev => prev[id] ? { ...prev, [id]: { ...prev[id], qty: val } } : prev);
  };

  const removeSelected = (id) => {
    setSelected(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const selectedItems = Object.values(selected);

  const totals = selectedItems.reduce(
    (acc, { ingredient, qty }) => {
      const factor = (parseFloat(qty) || 0) / ingredient.servingG;
      acc.cal += ingredient.calories * factor;
      acc.protein += ingredient.protein * factor;
      acc.fiber += ingredient.fiber * factor;
      return acc;
    },
    { cal: 0, protein: 0, fiber: 0 }
  );
  const ratio = totals.protein > 0 ? (totals.cal / totals.protein).toFixed(2) : null;

  const handleSave = () => {
    if (!name.trim()) { Alert.alert('Name required', 'Give your recipe a name.'); return; }
    if (selectedItems.length === 0) { Alert.alert('No ingredients', 'Select at least one ingredient.'); return; }
    onSave({
      id: editRecipe?.id || uid(),
      name: name.trim(),
      items: selectedItems.map(({ ingredient, qty }) => ({ ingredient, qty: parseFloat(qty) || 0 })),
      totals: { ...totals, ratio },
      createdAt: editRecipe?.createdAt || Date.now(),
    });
    onClose();
  };

  return (
    <>
      <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
          keyboardVerticalOffset={Platform.OS === 'android' ? 24 : 0}
        >
          <View style={[styles.modalSheet, { maxHeight: '92%' }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{editRecipe ? 'Edit Recipe' : 'New Recipe'}</Text>

            {/* Recipe name */}
            <Field
              label="Recipe name"
              value={name}
              onChangeText={setName}
              placeholder="e.g. Pre-Workout Bowl"
            />

            {/* Live totals summary */}
            {selectedItems.length > 0 && (
              <View style={styles.recipeSummaryBox}>
                <View style={styles.row}>
                  <StatPill label="kcal" value={totals.cal.toFixed(0)} color={C.accent} />
                  <StatPill label="protein" value={`${totals.protein.toFixed(1)}g`} color={C.green} />
                  <StatPill label="fiber" value={`${totals.fiber.toFixed(1)}g`} color={C.fiber} />
                  {ratio && <StatPill label="cal/g prot" value={ratio} color={C.accentDim} />}
                </View>
              </View>
            )}

            {/* Selected ingredients with qty inputs */}
            <ScrollView
              style={{ flex: 1 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {selectedItems.length === 0 ? (
                <Text style={[styles.textMuted, { textAlign: 'center', marginVertical: 20 }]}>
                  No ingredients added yet.{'\n'}Tap "Add Ingredients" below.
                </Text>
              ) : (
                selectedItems.map(({ ingredient, qty }) => (
                  <View key={ingredient.id} style={styles.selectedIngRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.selectedIngName}>{ingredient.name}</Text>
                      <Text style={styles.textMuted}>
                        {ingredient.calories} kcal · {ingredient.protein}g P · per {ingredient.servingG}g
                      </Text>
                    </View>
                    {/* Gram input */}
                    <View style={styles.qtyBox}>
                      <TextInput
                        style={styles.qtyInput}
                        value={qty}
                        onChangeText={v => setQty(ingredient.id, v)}
                        keyboardType="decimal-pad"
                        selectTextOnFocus
                      />
                      <Text style={styles.textMuted}>g</Text>
                    </View>
                    {/* Remove button */}
                    <TouchableOpacity onPress={() => removeSelected(ingredient.id)} style={{ paddingLeft: 10 }}>
                      <Text style={{ color: C.red, fontSize: 18 }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
              <View style={{ height: 8 }} />
            </ScrollView>

            {/* Add Ingredients button — opens the full-screen picker */}
            <TouchableOpacity
              style={[styles.btn, styles.btnOutline, { marginBottom: 10 }]}
              onPress={() => setPickerVisible(true)}
            >
              <Text style={styles.btnOutlineText}>
                {selectedItems.length === 0 ? '+ Add Ingredients' : '+ Add / Remove Ingredients'}
              </Text>
            </TouchableOpacity>

            <View style={styles.row}>
              <TouchableOpacity style={[styles.btn, styles.btnGhost, { flex: 1, marginRight: 8 }]} onPress={onClose}>
                <Text style={styles.btnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnAccent, { flex: 2 }]} onPress={handleSave}>
                <Text style={styles.btnAccentText}>Save Recipe</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Ingredient picker — rendered outside the bottom sheet modal so it sits on top */}
      <IngredientPickerModal
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        ingredients={ingredients}
        selected={selected}
        onToggle={toggleIngredient}
        onSetQty={setQty}
      />
    </>
  );
}

// ─── Recipe Card ─────────────────────────────────────────────────────────────
function RecipeCard({ recipe, onEdit, onDelete, ingredients }) {
  const [expanded, setExpanded] = useState(false);

  // Always recompute totals live from latest ingredient data
  const freshItems = recipe.items.map(item => {
    const fresh = ingredients.find(i => i.id === item.ingredient.id);
    return { ingredient: fresh || item.ingredient, qty: item.qty };
  });
  const totals = recomputeTotals(freshItems);

  return (
    <TouchableOpacity style={styles.recipeCard} onPress={() => setExpanded(e => !e)} activeOpacity={0.85}>
      <View style={styles.recipeCardHeader}>
        <Text style={styles.recipeCardName}>{recipe.name}</Text>
        <View style={styles.row}>
          <TouchableOpacity onPress={() => onEdit(recipe)} style={{ marginRight: 12 }}>
            <Text style={styles.cardAction}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onDelete(recipe.id)}>
            <Text style={[styles.cardAction, { color: C.red }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.row}>
        <StatPill label="kcal" value={totals.cal.toFixed(0)} color={C.accent} />
        <StatPill label="protein" value={`${totals.protein.toFixed(1)}g`} color={C.green} />
        <StatPill label="fiber" value={`${totals.fiber.toFixed(1)}g`} color={C.fiber} />
        {totals.ratio && <StatPill label="cal/g prot" value={totals.ratio} color={C.accentDim} />}
      </View>
      {expanded && (
        <View style={styles.recipeIngList}>
          {freshItems.map(({ ingredient, qty }) => {
            const factor = qty / ingredient.servingG;
            return (
              <View key={ingredient.id} style={styles.recipeIngItem}>
                <Text style={styles.recipeIngName}>{ingredient.name}</Text>
                <Text style={styles.textMuted}>
                  {qty}g · {(ingredient.calories * factor).toFixed(0)} kcal · {(ingredient.protein * factor).toFixed(1)}g P
                </Text>
              </View>
            );
          })}
        </View>
      )}
      <Text style={[styles.textMuted, { textAlign: 'center', marginTop: 4, fontSize: 11 }]}>
        {expanded ? '▲ collapse' : '▼ tap to expand'}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Main App ────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState('pantry');
  const [ingredients, setIngredients] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [ingModalVisible, setIngModalVisible] = useState(false);
  const [editIngredient, setEditIngredient] = useState(null);
  const [recipeVisible, setRecipeVisible] = useState(false);
  const [editRecipe, setEditRecipe] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [ings, recs] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.INGREDIENTS),
          AsyncStorage.getItem(STORAGE_KEYS.RECIPES),
        ]);
        if (ings) setIngredients(JSON.parse(ings));
        if (recs) setRecipes(JSON.parse(recs));
      } catch (e) { console.warn('Storage load error', e); }
      setLoaded(true);
    })();
  }, []);

  const persistIngredients = useCallback(async (list) => {
    setIngredients(list);
    await AsyncStorage.setItem(STORAGE_KEYS.INGREDIENTS, JSON.stringify(list));
  }, []);

  const persistRecipes = useCallback(async (list) => {
    setRecipes(list);
    await AsyncStorage.setItem(STORAGE_KEYS.RECIPES, JSON.stringify(list));
  }, []);

  // When an ingredient is saved (new or edited), update all recipes that use it
  const handleSaveIngredient = useCallback((ing) => {
    const isEdit = !!ingredients.find(i => i.id === ing.id);
    const newIngList = isEdit
      ? ingredients.map(i => i.id === ing.id ? ing : i)
      : [...ingredients, ing];
    persistIngredients(newIngList);

    if (isEdit) {
      // Propagate updated macros into every recipe that references this ingredient
      const updatedRecipes = recipes.map(recipe => {
        const hasIt = recipe.items.some(item => item.ingredient.id === ing.id);
        if (!hasIt) return recipe;
        const newItems = recipe.items.map(item =>
          item.ingredient.id === ing.id
            ? { ...item, ingredient: ing }
            : item
        );
        return { ...recipe, items: newItems, totals: recomputeTotals(newItems) };
      });
      persistRecipes(updatedRecipes);
    }

    setEditIngredient(null);
  }, [ingredients, recipes, persistIngredients, persistRecipes]);

  const handleDeleteIngredient = (id) => {
    Alert.alert('Delete ingredient?', "This won't affect saved recipes.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => persistIngredients(ingredients.filter(i => i.id !== id)) },
    ]);
  };

  const handleSaveRecipe = (recipe) => {
    const existing = recipes.find(r => r.id === recipe.id);
    const newList = existing
      ? recipes.map(r => r.id === recipe.id ? recipe : r)
      : [recipe, ...recipes];
    persistRecipes(newList);
    setEditRecipe(null);
  };

  const handleDeleteRecipe = (id) => {
    Alert.alert('Delete recipe?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => persistRecipes(recipes.filter(r => r.id !== id)) },
    ]);
  };

  if (!loaded) return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      <View style={styles.header}>
        <Text style={styles.logo}>⚖ Pantry</Text>
        <Text style={styles.logoSub}>nutrition tracker</Text>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'pantry' && styles.tabActive]}
          onPress={() => setTab('pantry')}
        >
          <Text style={[styles.tabText, tab === 'pantry' && styles.tabTextActive]}>
            Pantry ({ingredients.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'recipes' && styles.tabActive]}
          onPress={() => setTab('recipes')}
        >
          <Text style={[styles.tabText, tab === 'recipes' && styles.tabTextActive]}>
            Recipes ({recipes.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Pantry Tab */}
      {tab === 'pantry' && (
        <FlatList
          data={ingredients}
          keyExtractor={i => i.id}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <SectionHeader
              title="Ingredients"
              action={() => { setEditIngredient(null); setIngModalVisible(true); }}
              actionLabel="+ Add"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🧂</Text>
              <Text style={styles.emptyTitle}>Pantry is empty</Text>
              <Text style={styles.emptyBody}>Tap "+ Add" to add your first ingredient.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.ingCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.ingCardName}>{item.name}</Text>
                <Text style={styles.textMuted}>Per {item.servingG}g serving</Text>
                <View style={[styles.row, { marginTop: 6 }]}>
                  <StatPill label="kcal" value={item.calories} color={C.accent} />
                  <StatPill label="protein" value={`${item.protein}g`} color={C.green} />
                  <StatPill label="fiber" value={`${item.fiber}g`} color={C.fiber} />
                </View>
                <Text style={[styles.textMuted, { marginTop: 4, fontSize: 12 }]}>
                  {calcRatio(item.calories, item.protein)} cal/g protein
                </Text>
              </View>
              <View style={styles.cardActions}>
                <TouchableOpacity
                  onPress={() => { setEditIngredient(item); setIngModalVisible(true); }}
                  style={styles.cardActionBtn}
                >
                  <Text style={styles.cardActionEdit}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDeleteIngredient(item.id)} style={styles.cardActionBtn}>
                  <Text style={{ color: C.red, fontSize: 16 }}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      {/* Recipes Tab */}
      {tab === 'recipes' && (
        <FlatList
          data={recipes}
          keyExtractor={r => r.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <SectionHeader
              title="Recipes"
              action={() => { setEditRecipe(null); setRecipeVisible(true); }}
              actionLabel="+ New"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyTitle}>No recipes yet</Text>
              <Text style={styles.emptyBody}>Tap "+ New" to build your first recipe.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <RecipeCard
              recipe={item}
              ingredients={ingredients}
              onEdit={(r) => { setEditRecipe(r); setRecipeVisible(true); }}
              onDelete={handleDeleteRecipe}
            />
          )}
        />
      )}

      <IngredientModal
        visible={ingModalVisible}
        onClose={() => { setIngModalVisible(false); setEditIngredient(null); }}
        onSave={handleSaveIngredient}
        editIngredient={editIngredient}
      />

      <RecipeBuilderModal
        visible={recipeVisible}
        onClose={() => { setRecipeVisible(false); setEditRecipe(null); }}
        ingredients={ingredients}
        onSave={handleSaveRecipe}
        editRecipe={editRecipe}
      />
    </View>
  );
}

AppRegistry.registerComponent('main', () => App);

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 44,
  },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  logo: { fontSize: 26, fontWeight: '700', color: C.accent, letterSpacing: 1 },
  logoSub: { fontSize: 12, color: C.textMuted, letterSpacing: 3, textTransform: 'uppercase', marginTop: -2 },

  tabs: { flexDirection: 'row', marginHorizontal: 20, marginVertical: 12, backgroundColor: C.surface, borderRadius: 10, padding: 3 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  tabActive: { backgroundColor: C.card },
  tabText: { color: C.textMuted, fontWeight: '600', fontSize: 14 },
  tabTextActive: { color: C.accent },

  listContent: { paddingHorizontal: 20, paddingBottom: 40 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: C.textMuted, letterSpacing: 2, textTransform: 'uppercase' },
  sectionAction: { fontSize: 15, fontWeight: '700', color: C.accent },

  ingCard: { backgroundColor: C.card, borderRadius: 12, padding: 14, marginBottom: 10, flexDirection: 'row', borderWidth: 1, borderColor: C.border },
  ingCardName: { fontSize: 16, fontWeight: '600', color: C.text, marginBottom: 2 },
  cardActions: { alignItems: 'flex-end', justifyContent: 'space-between', paddingLeft: 8 },
  cardActionBtn: { padding: 4 },
  cardActionEdit: { color: C.accentDim, fontSize: 13, fontWeight: '600' },

  recipeCard: { backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  recipeCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  recipeCardName: { fontSize: 17, fontWeight: '700', color: C.text, flex: 1 },
  cardAction: { fontSize: 13, color: C.accentDim, fontWeight: '600' },
  recipeIngList: { marginTop: 10, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10 },
  recipeIngItem: { marginBottom: 6 },
  recipeIngName: { fontSize: 14, color: C.text, fontWeight: '500' },

  statPill: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4, marginRight: 6, marginBottom: 4, alignItems: 'center', minWidth: 50 },
  statValue: { fontSize: 14, fontWeight: '700' },
  statLabel: { fontSize: 10, color: C.textMuted, marginTop: 1 },

  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: C.text, marginBottom: 6 },
  emptyBody: { fontSize: 14, color: C.textMuted, textAlign: 'center' },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' },
  modalSheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 36,
    maxHeight: '92%',
  },
  modalHandle: { width: 40, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: C.text, marginBottom: 16 },

  field: { marginBottom: 12 },
  fieldLabel: { fontSize: 12, color: C.textMuted, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 },
  input: { backgroundColor: C.card, borderRadius: 10, borderWidth: 1, borderColor: C.border, color: C.text, fontSize: 15, paddingHorizontal: 14, paddingVertical: 10 },

  recipeSummaryBox: { backgroundColor: C.card, borderRadius: 12, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: C.border },

  // Selected ingredients in the recipe builder (with qty inputs)
  selectedIngRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  selectedIngName: { fontSize: 15, fontWeight: '600', color: C.text, marginBottom: 2 },
  qtyBox: { flexDirection: 'row', alignItems: 'center', marginLeft: 8 },
  qtyInput: {
    backgroundColor: C.bg, borderWidth: 1, borderColor: C.accentDim, borderRadius: 8,
    color: C.accent, fontSize: 15, fontWeight: '700',
    paddingHorizontal: 8, paddingVertical: 6, width: 58, textAlign: 'center', marginRight: 4,
  },

  // Ingredient picker (full-screen modal)
  pickerContainer: {
    flex: 1,
    backgroundColor: C.bg,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 44,
  },
  pickerHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  pickerTitle: { fontSize: 20, fontWeight: '700', color: C.text },
  pickerDoneBtn: { backgroundColor: C.accent, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 7 },
  pickerDoneText: { color: C.bg, fontWeight: '800', fontSize: 15 },

  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border,
    marginHorizontal: 20, marginVertical: 12,
    paddingHorizontal: 12,
  },
  searchIcon: { fontSize: 15, marginRight: 6 },
  searchInput: { flex: 1, color: C.text, fontSize: 15, paddingVertical: 10 },

  selectedBanner: {
    backgroundColor: C.accentDim + '33',
    borderRadius: 8, marginHorizontal: 20, marginBottom: 8,
    paddingVertical: 6, paddingHorizontal: 12,
    borderWidth: 1, borderColor: C.accentDim + '66',
  },
  selectedBannerText: { color: C.accent, fontWeight: '600', fontSize: 13 },

  pickerRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  pickerRowSelected: { borderBottomColor: C.accentDim + '55' },
  pickerCheck: {
    width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: C.border,
    marginRight: 12, alignItems: 'center', justifyContent: 'center',
  },
  pickerCheckFilled: { backgroundColor: C.accent, borderColor: C.accent },
  pickerCheckMark: { color: C.bg, fontWeight: '800', fontSize: 14 },
  pickerRowName: { fontSize: 15, fontWeight: '600', color: C.text, marginBottom: 2 },

  btn: { borderRadius: 12, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  btnAccent: { backgroundColor: C.accent },
  btnAccentText: { color: C.bg, fontWeight: '800', fontSize: 15 },
  btnGhost: { borderWidth: 1, borderColor: C.border },
  btnGhostText: { color: C.textMuted, fontWeight: '600', fontSize: 15 },
  btnOutline: { borderWidth: 1.5, borderColor: C.accentDim, borderRadius: 12, paddingVertical: 11 },
  btnOutlineText: { color: C.accent, fontWeight: '700', fontSize: 14, textAlign: 'center' },

  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  textMuted: { color: C.textMuted, fontSize: 13 },
});

AppRegistry.registerComponent('main', () => App);