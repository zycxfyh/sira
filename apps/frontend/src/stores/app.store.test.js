import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAppStore } from './app.store';

describe('useAppStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('should initialize with null uploadedCharacterCard', () => {
    const store = useAppStore();

    expect(store.uploadedCharacterCard).toBeNull();
  });

  it('should set uploaded character card', () => {
    const store = useAppStore();
    const cardData = { name: 'Test Character', description: 'A test character' };

    store.setUploadedCharacterCard(cardData);

    expect(store.uploadedCharacterCard).toEqual(cardData);
  });

  it('should clear uploaded character card', () => {
    const store = useAppStore();
    const cardData = { name: 'Test Character', description: 'A test character' };

    store.setUploadedCharacterCard(cardData);
    expect(store.uploadedCharacterCard).toEqual(cardData);

    store.clearUploadedCharacterCard();
    expect(store.uploadedCharacterCard).toBeNull();
  });

  it('should allow multiple operations', () => {
    const store = useAppStore();
    const cardData1 = { name: 'Character 1' };
    const cardData2 = { name: 'Character 2' };

    store.setUploadedCharacterCard(cardData1);
    expect(store.uploadedCharacterCard).toEqual(cardData1);

    store.setUploadedCharacterCard(cardData2);
    expect(store.uploadedCharacterCard).toEqual(cardData2);

    store.clearUploadedCharacterCard();
    expect(store.uploadedCharacterCard).toBeNull();
  });
});
