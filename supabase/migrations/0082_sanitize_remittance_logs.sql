-- Sanitize existing swift_bic logs by partial masking
UPDATE public.supplier_remittance_logs
SET 
  old_value = CASE 
    WHEN old_value IS NOT NULL AND length(old_value) > 4 THEN substring(old_value from 1 for 4) || '••••'
    WHEN old_value IS NOT NULL THEN '••••'
    ELSE NULL
  END,
  new_value = CASE 
    WHEN new_value IS NOT NULL AND length(new_value) > 4 THEN substring(new_value from 1 for 4) || '••••'
    WHEN new_value IS NOT NULL THEN '••••'
    ELSE NULL
  END
WHERE field_name = 'swift_bic';

-- Sanitize account_number logs (just in case)
UPDATE public.supplier_remittance_logs
SET 
  old_value = CASE 
    WHEN old_value IS NOT NULL AND old_value NOT LIKE '•%' AND length(old_value) > 4 THEN '••••••••' || right(old_value, 4)
    WHEN old_value IS NOT NULL AND old_value NOT LIKE '•%' THEN '••••'
    ELSE old_value
  END,
  new_value = CASE 
    WHEN new_value IS NOT NULL AND new_value NOT LIKE '•%' AND length(new_value) > 4 THEN '••••••••' || right(new_value, 4)
    WHEN new_value IS NOT NULL AND new_value NOT LIKE '•%' THEN '••••'
    ELSE new_value
  END
WHERE field_name = 'account_number';

-- Sanitize routing_number logs (just in case)
UPDATE public.supplier_remittance_logs
SET 
  old_value = CASE 
    WHEN old_value IS NOT NULL AND old_value NOT LIKE '•%' AND length(old_value) > 4 THEN '••••••••' || right(old_value, 4)
    WHEN old_value IS NOT NULL AND old_value NOT LIKE '•%' THEN '••••'
    ELSE old_value
  END,
  new_value = CASE 
    WHEN new_value IS NOT NULL AND new_value NOT LIKE '•%' AND length(new_value) > 4 THEN '••••••••' || right(new_value, 4)
    WHEN new_value IS NOT NULL AND new_value NOT LIKE '•%' THEN '••••'
    ELSE new_value
  END
WHERE field_name = 'routing_number';
