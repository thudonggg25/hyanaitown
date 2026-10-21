# Prompt GPT vẽ ảnh cho Thị trấn AI

Mỗi khung dưới đây là **một prompt riêng**, chép nguyên khung dán vào ChatGPT (tạo ảnh).
Prompt viết tiếng Anh vì GPT vẽ bám ý hơn. Mỗi lần chỉ dán một prompt, một ảnh.

Cách gửi lại: tải ảnh PNG về, đặt tên đúng như ghi ở mỗi mục, gửi vào chat thread.
Claude sẽ cắt, xoá nền, **lưu ảnh vào repo** (`web/assets/ui/`, `web/assets/sprites/`) rồi lắp vào game.

Mẹo chung:
- Luôn chọn khổ ảnh như ghi trong prompt (vuông hoặc ngang).
- Nếu GPT vẽ nền trắng thay vì trong suốt cũng không sao, Claude tự xoá nền.
- Ảnh nào lệch phong cách thì bảo GPT: "Make it match the reference style more closely" và đính kèm lại ảnh mẫu.

---

## Phần 1. Dáng đi nhiều khung (walk cycle)

Hiện mỗi nhân vật chỉ có 4 dáng đứng, game đang giả bước đi bằng nhún nhảy. Có ảnh dưới đây thì
nhân vật sẽ bước chân thật.

**Mỗi nhân vật cần 3 ảnh** (đi xuống, đi lên, đi sang trái). Đi sang phải thì game tự lật ảnh sang trái.
Nếu muốn đẹp hơn (tay cầm đồ không bị đổi bên khi lật) thì làm thêm ảnh thứ 4 đi sang phải.

Trước khi dán prompt: **đính kèm ảnh 4 dáng của nhân vật đó** làm mẫu. Ảnh nằm trong máy ở
`web\assets\art\01_Nhan_vat_chibi\` (hoặc bản đã tách nền ở `web\assets\sprites\nv\`).

| Nhân vật | Ảnh mẫu đính kèm | Tên tệp gửi lại |
|---|---|---|
| Calm | `calm_trong_bon_tu_the.webp` | `calm-xuong.png`, `calm-len.png`, `calm-trai.png` |
| Anicca | `bang_nhan_vat_anicca_bon_tu_the.webp` | `anicca-…` |
| Coder 1, 3 | `coder_trong_bon_tu_the.webp` | `coder-…` |
| Coder 2 | `sprites\nv\coder-b.webp` | `coder-b-…` |
| Thiết kế | `sprites\nv\thiet-ke.webp` | `thiet-ke-…` |
| Sản phẩm | `sprites\nv\san-pham.webp` | `san-pham-…` |
| Tiếp nhận | `sprites\nv\tiep-nhan.webp` | `tiep-nhan-…` |
| QA | `tro_ly_qa_voi_kinh_lup.webp` | `qa-…` |
| Khách | `sprites\nv\khach.webp` | `khach-…` |

Nên làm thử **một nhân vật (Calm) trước**, Claude lắp vào xem ổn rồi mới làm tiếp các nhân vật khác.

### 1a. Đi xuống (về phía người xem) → `<tên>-xuong.png`

```
Use the attached character sheet as the exact character reference: same face, hair, outfit, colors, props and proportions.

Create a WALK CYCLE sprite strip of this chibi character walking TOWARD the viewer (facing down / front view).
- Exactly 6 frames in ONE horizontal row, evenly spaced, same size, same scale, same baseline (feet on the same line in every frame).
- Frame order: right foot contact, down (weight on right), passing, left foot contact, down (weight on left), passing.
- Natural walk: legs alternate, arms swing opposite to legs (if holding a prop, the prop moves gently with the body), small up-and-down body bob, head stays steady.
- Full body visible in every frame, nothing cropped, generous empty space between frames.
- Style: soft hand-painted anime chibi illustration, warm watercolor/gouache texture, clean brown line art, pastel cozy palette, gentle soft shading, same as the reference.
- Transparent background (or plain pure white if transparency is not possible). No ground, no shadow, no text, no frame numbers, no borders.
- Image size 1536x1024 (landscape).
```

### 1b. Đi lên (quay lưng) → `<tên>-len.png`

```
Use the attached character sheet as the exact character reference: same face, hair, outfit, colors, props and proportions.

Create a WALK CYCLE sprite strip of this chibi character walking AWAY from the viewer (back view, we see the back of the head).
- Exactly 6 frames in ONE horizontal row, evenly spaced, same size, same scale, same baseline (feet on the same line in every frame).
- Frame order: right foot contact, down, passing, left foot contact, down, passing.
- Natural walk: legs alternate, arms swing opposite to legs, small up-and-down body bob, heels visible as feet lift.
- Full body visible in every frame, nothing cropped, generous empty space between frames.
- Style: soft hand-painted anime chibi illustration, warm watercolor/gouache texture, clean brown line art, pastel cozy palette, gentle soft shading, same as the reference.
- Transparent background (or plain pure white if transparency is not possible). No ground, no shadow, no text, no frame numbers, no borders.
- Image size 1536x1024 (landscape).
```

### 1c. Đi sang trái (nhìn nghiêng) → `<tên>-trai.png`

```
Use the attached character sheet as the exact character reference: same face, hair, outfit, colors, props and proportions.

Create a WALK CYCLE sprite strip of this chibi character walking to the LEFT (side view, 3/4 profile, facing the left edge of the image).
- Exactly 6 frames in ONE horizontal row, evenly spaced, same size, same scale, same baseline (feet on the same line in every frame).
- Frame order: contact (front foot heel down), down (knees bent, body lowest), passing (one leg straight under body), up (body highest, back foot pushing off), contact with the other foot, passing.
- Clear stride: legs open wide on contact frames and cross on passing frames, arms swing opposite to legs, body leans slightly forward, gentle bounce.
- Full body visible in every frame, nothing cropped, generous empty space between frames.
- Style: soft hand-painted anime chibi illustration, warm watercolor/gouache texture, clean brown line art, pastel cozy palette, gentle soft shading, same as the reference.
- Transparent background (or plain pure white if transparency is not possible). No ground, no shadow, no text, no frame numbers, no borders.
- Image size 1536x1024 (landscape).
```

(Muốn có ảnh đi sang phải riêng: dùng prompt 1c, đổi `to the LEFT` thành `to the RIGHT` và `facing the left edge` thành `facing the right edge`, tên tệp `<tên>-phai.png`.)

---

## Phần 2. Giao diện game (UI)

Chữ trên giao diện do game tự viết (tiếng Việt), nên **ảnh UI không được có chữ**.
Khung và nút cần phần giữa trơn để game kéo giãn theo độ dài chữ.

Ảnh mẫu phong cách (đính kèm khi dán prompt cho chắc ăn):
`web\assets\art\06_Giao_dien_game\van_phong_ai_anime_ve_tay.webp`.

Phong cách chung đã có sẵn trong từng prompt, không cần dán thêm.

### 2a. Thông báo nổi (toast) → `ui-toast.png`

```
Game UI asset sheet for a cozy hand-painted anime town game (soft watercolor/gouache texture, cream paper, warm brown hand-drawn outlines, pastel palette, gentle soft shadow, rounded friendly shapes, like a Studio Ghibli inspired cozy game).

Draw 4 NOTIFICATION TOAST banners stacked vertically, each a wide horizontal pill/ribbon card (about 5:1 ratio), same shape, different accent:
1. info: soft sage green accent, small leaf corner ornament
2. success / task done: mint green accent, tiny sparkle ornament
3. warning / needs approval: warm amber/honey accent, tiny bell ornament
4. error: soft coral red accent, tiny crack/thorn ornament
Each toast has: a round icon slot on the left (empty circle, no icon inside), and a large EMPTY plain cream center area for text. Thin hand-drawn outline, subtle paper texture, soft drop shadow.
NO text, NO letters, NO icons inside the circles. Transparent background, generous spacing between items. Image 1024x1536 (portrait).
```

### 2b. Hộp cảnh báo / hỏi duyệt (popup) → `ui-popup.png`

```
Game UI asset for a cozy hand-painted anime town game (soft watercolor/gouache texture, cream paper, warm brown hand-drawn outlines, pastel palette, gentle soft shadow, rounded friendly shapes).

Draw 2 MODAL DIALOG frames side by side, front view, flat (no perspective):
1. warning dialog: cream parchment card with a honey/amber header ribbon at the top and a small round bell emblem on the ribbon
2. error dialog: same card shape with a soft coral red header ribbon and a small round exclamation emblem (just a shape, no letter)
Each dialog: rounded corners, decorative but simple hand-painted border (thin vine or stitched edge), a large EMPTY plain center area for text, and an empty strip at the bottom where buttons will go. Corners and borders must be uniform so the frame can be 9-slice stretched.
NO text, NO letters, NO buttons drawn. Transparent background. Image 1536x1024 (landscape).
```

### 2c. Nút bấm 3 trạng thái → `ui-buttons.png`

```
Game UI button sprite sheet for a cozy hand-painted anime town game (soft watercolor/gouache texture, warm brown hand-drawn outlines, pastel palette, rounded friendly shapes).

Draw a grid of wide rounded-pill BUTTONS (about 3:1 ratio), all the exact same size and shape, front view, flat:
- Rows (color): 1 primary = sage green, 2 secondary = cream/ivory, 3 warning = honey amber, 4 danger = soft coral red.
- Columns (state): 1 normal (soft drop shadow, slightly raised), 2 hover (a little brighter with a soft glow rim), 3 pressed (darker, pushed down 2px, inner shadow, no drop shadow), 4 disabled (desaturated grey, flat, faded).
Plain empty center on every button for text. Uniform borders so they can be 9-slice stretched.
NO text, NO letters, NO icons. Transparent background, equal spacing, buttons aligned in a neat 4x4 grid. Image 1536x1024 (landscape).
```

### 2d. Bảng và khung cửa sổ (panel) → `ui-panels.png`

```
Game UI panel frames for a cozy hand-painted anime town game (soft watercolor/gouache texture, cream paper, warm brown hand-drawn outlines, pastel palette, gentle soft shadow).

Draw 4 separate PANEL frames, front view, flat, arranged in a 2x2 grid:
1. large side panel (tall rectangle) with a wooden-plank header bar at the top, cream paper body
2. small info card (rounded rectangle) with a thin stitched border
3. speech bubble for characters: soft white rounded bubble with a small tail pointing down-center
4. name tag plate: small rounded wooden plate with tiny nails at the ends
All bodies are EMPTY and plain in the middle (for text). Corners/borders uniform for 9-slice stretching. Slight paper grain, subtle soft shadow.
NO text, NO letters. Transparent background, generous spacing. Image 1536x1024 (landscape).
```

### 2e. Nhãn trạng thái (badge) → `ui-badges.png`

```
Game UI status badges for a cozy hand-painted anime town game (soft watercolor/gouache texture, warm brown hand-drawn outlines, pastel palette).

Draw 7 small rounded-pill STATUS BADGES in one neat column, all the same size (about 3.5:1 ratio), each with a small round dot/icon on the left and an empty center for text:
1. running: sage green, dot is a tiny play triangle
2. upcoming / queued: soft sky blue, tiny clock
3. waiting for approval: honey amber, tiny hourglass
4. approved: mint green, tiny check mark
5. done: soft teal, tiny star
6. rejected: dusty rose, tiny cross
7. error: coral red, tiny exclamation shape (shape only, not a letter)
Hand-painted texture, thin outline, soft highlight on top.
NO text, NO letters. Transparent background, equal spacing. Image 1024x1536 (portrait).
```

### 2f. Thanh tiến độ (progress bar) → `ui-progress.png`

```
Game UI progress bar parts for a cozy hand-painted anime town game (soft watercolor/gouache texture, warm brown hand-drawn outlines, pastel palette).

Draw, stacked vertically with space between:
1. an EMPTY progress bar track: long rounded groove, cream with inner shadow, thin brown outline (about 10:1 ratio)
2. the FILL bar alone, same length and height as the inside of the track: fresh sage-to-mint green gradient with a soft glossy highlight and subtle diagonal watercolor stripes
3. the same fill in honey amber
4. the same fill in coral red
5. a small round end-cap knob decorated like a little seed/leaf, to sit at the end of the fill
Horizontal, front view, flat, uniform ends so the middle can be stretched.
NO text, NO numbers. Transparent background. Image 1536x1024 (landscape).
```

### 2g. Bộ icon → `ui-icons.png`

```
Game icon set for a cozy hand-painted anime town game (soft watercolor/gouache texture, warm brown hand-drawn outlines, pastel palette, cute chibi-object style), matching the attached reference.

Draw 16 ICONS in a neat 4x4 grid, each centered in its own equal square cell, same visual size and line weight:
row 1: play (auto run), pause/stop, eye (names toggle), speech bubble (bubbles toggle)
row 2: map/compass (overview), scroll/log book, house (home view), bell (notification)
row 3: check mark seal (approve), cross (reject), warning triangle with exclamation shape, broken gear (error)
row 4: speaker (sound on), speaker muted, music note, envelope (hand-off)
Each icon is a small object with soft shading and a subtle cream glow, no background plate.
NO text, NO letters. Transparent background, generous padding. Image 1024x1024 (square).
```

---

## Phần 3. Âm thanh (nếu muốn thay tiếng tự tạo)

Game đang tự tạo tiếng báo và nhạc nền bằng code, chưa cần tải gì. Nếu muốn tiếng "thật" hơn,
tải các gói **CC0** (dùng tự do, không cần ghi công) rồi gửi tệp vào chat:

- Kenney Interface Sounds: https://kenney.nl/assets/interface-sounds
- Kenney UI Audio: https://kenney.nl/assets/ui-audio
- Nhạc nền lo-fi: tìm trên https://pixabay.com/music/ với từ khoá "lofi cozy" (giấy phép Pixabay, dùng miễn phí).

Claude sẽ khai báo tệp trong `web/sound.js` (mục `FILES`), tệp nào có thì thay tiếng tự tạo.
