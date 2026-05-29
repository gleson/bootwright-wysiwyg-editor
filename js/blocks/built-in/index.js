import { Section } from './Section.js';
import { Row } from './Row.js';
import { Column } from './Column.js';
import { Heading } from './Heading.js';
import { Paragraph } from './Paragraph.js';
import { Image } from './Image.js';
import { Button } from './Button.js';
import { List } from './List.js';
import { Divider } from './Divider.js';
import { Spacer } from './Spacer.js';
import { HtmlEmbed } from './HtmlEmbed.js';
import { Icon } from './Icon.js';
import { Table } from './Table.js';
import { Blockquote } from './Blockquote.js';
import { Audio } from './Audio.js';
import { Video } from './Video.js';
import { Badge } from './Badge.js';
import { Alert } from './Alert.js';
import { Card } from './Card.js';
import { Progress } from './Progress.js';
import { Spinner } from './Spinner.js';
import { Carousel } from './Carousel.js';
import { Tabs } from './Tabs.js';
import { Accordion } from './Accordion.js';
import { Repeater } from './Repeater.js';
import { Form } from './Form.js';
import { FormInput } from './FormInput.js';
import { FormTextarea } from './FormTextarea.js';
import { FormSelect } from './FormSelect.js';
import { FormCheckbox } from './FormCheckbox.js';
import { FormSubmit } from './FormSubmit.js';
import { Code } from './Code.js';
import { DjangoVar } from './DjangoVar.js';

/** Lista usada pelo Editor para registrar todos os blocos built-in de uma vez. */
export const builtInBlocks = [
  // === BLOCOS (basic) ===
  // Estrutura
  Section, Row, Column,
  // Conteúdo
  Heading, Paragraph, Blockquote, Image, Audio, Video, Button, List, Icon, Table, Code,
  // Utilitários
  Divider, Spacer, HtmlEmbed,

  // === BOOTSTRAP ===
  Badge, Alert, Card, Progress, Spinner,

  // === ELEMENTOS ===
  Carousel, Tabs, Accordion, Repeater, DjangoVar,
  // Formulário
  Form, FormInput, FormTextarea, FormSelect, FormCheckbox, FormSubmit,
];

export {
  Section, Row, Column,
  Heading, Paragraph, Blockquote, Image, Audio, Video, Button, List, Icon, Table, Code,
  Divider, Spacer, HtmlEmbed,
  Badge, Alert, Card, Progress, Spinner,
  Carousel, Tabs, Accordion, Repeater, DjangoVar,
  Form, FormInput, FormTextarea, FormSelect, FormCheckbox, FormSubmit,
};
