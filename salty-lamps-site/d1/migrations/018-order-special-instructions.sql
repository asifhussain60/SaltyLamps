-- The optional "Special instructions" note a customer types at checkout, kept with the order so
-- the owner can read it when packing. Blank means no note; orders placed before this column exist get ''.
ALTER TABLE orders ADD COLUMN special_instructions TEXT NOT NULL DEFAULT '';
