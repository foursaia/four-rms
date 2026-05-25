-- Migration: Add Inventory Tracking to Ingredients
ALTER TABLE ingredients ADD COLUMN current_stock INT DEFAULT 50;
ALTER TABLE ingredients ADD COLUMN low_stock_threshold INT DEFAULT 10;
