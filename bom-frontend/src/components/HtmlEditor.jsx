import React from 'react'
import { Box, Stack, ToggleButton, Typography } from '@mui/material'
import FormatBoldIcon from '@mui/icons-material/FormatBold'
import FormatItalicIcon from '@mui/icons-material/FormatItalic'
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted'
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered'
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined'
import LinkIcon from '@mui/icons-material/Link'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'

/** Minimal HTML WYSIWYG editor (Tiptap). Controlled: value/onChange are HTML strings. */
export default function HtmlEditor({ label, value, onChange, minHeight = 180 }) {
  const editor = useEditor({
    extensions: [StarterKit, Underline, Link.configure({ openOnClick: false })],
    content: value || '',
    onUpdate: ({ editor: instance }) => onChange(instance.getHTML()),
  })

  React.useEffect(() => {
    if (editor && value !== editor.getHTML()) editor.commands.setContent(value || '', false)
    // Only resync when the value changes from OUTSIDE this editor (e.g. loading a
    // different row) -- not on every keystroke, which would fight the cursor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  if (!editor) return null

  const toolbarButtonSx = { border: 0, px: 1 }

  return <Box>
    {label && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>{label}</Typography>}
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
      <Stack direction="row" sx={{ borderBottom: '1px solid', borderColor: 'divider', px: 0.5 }}>
        <ToggleButton size="small" value="on" selected={editor.isActive('bold')} sx={toolbarButtonSx}
          onClick={() => editor.chain().focus().toggleBold().run()}>
          <FormatBoldIcon fontSize="small" />
        </ToggleButton>
        <ToggleButton size="small" value="on" selected={editor.isActive('italic')} sx={toolbarButtonSx}
          onClick={() => editor.chain().focus().toggleItalic().run()}>
          <FormatItalicIcon fontSize="small" />
        </ToggleButton>
        <ToggleButton size="small" value="on" selected={editor.isActive('underline')} sx={toolbarButtonSx}
          onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <FormatUnderlinedIcon fontSize="small" />
        </ToggleButton>
        <ToggleButton size="small" value="on" selected={editor.isActive('bulletList')} sx={toolbarButtonSx}
          onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <FormatListBulletedIcon fontSize="small" />
        </ToggleButton>
        <ToggleButton size="small" value="on" selected={editor.isActive('orderedList')} sx={toolbarButtonSx}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <FormatListNumberedIcon fontSize="small" />
        </ToggleButton>
        <ToggleButton size="small" value="on" selected={editor.isActive('link')} sx={toolbarButtonSx}
          onClick={() => {
            const url = window.prompt('URL')
            if (url) editor.chain().focus().setLink({ href: url }).run()
          }}>
          <LinkIcon fontSize="small" />
        </ToggleButton>
      </Stack>
      <Box sx={{ p: 1.5, minHeight, '& .ProseMirror': { outline: 'none', minHeight } }}>
        <EditorContent editor={editor} />
      </Box>
    </Box>
  </Box>
}
