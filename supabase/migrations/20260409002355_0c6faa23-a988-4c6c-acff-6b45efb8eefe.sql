UPDATE products SET owner_user_id = 'f10d8ed9-24d3-45d6-a310-d45db5a747a0'
WHERE id IN (
  'cb82d700-2d6a-4aea-a192-4e4b54054566',
  '2f6f8e45-f2cc-465d-91c8-0b99e659ccb0',
  'd9922e1d-a495-4f04-aade-37d8a63f023b',
  '22f44465-e83f-4e6e-ad4e-46283b8d3ca6',
  '116ed0b0-72b1-4186-a5ba-09e319a9aee0',
  '388791c1-b83a-42cd-89b4-70dc942f5613'
) AND owner_user_id IS NULL;